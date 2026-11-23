#!/usr/bin/env node
/**
 * Bot-user simulation: many simulated members use the site at the same time so
 * we can see how it behaves and how fast it responds. Each bot follows a
 * realistic journey with random "think time" between steps:
 *
 *   owners     sign up → verify email → photo → profile → documents → get approved
 *              → publish a loan request → answer offers and messages
 *   investors  sign up → verify → profile → documents → get approved → browse and
 *              search → view businesses → make offers → message owners
 *   visitors   (anonymous) landing page, explore, public profiles and requests
 *
 *   pnpm bots                       # 8 owners, 8 investors, 20 visitors
 *   BOTS_OWNERS=20 BOTS_INVESTORS=20 BOTS_VISITORS=60 pnpm bots
 *
 * Env: BOTS_API (default http://localhost:4000), BOTS_WEB (frontend, default
 * http://localhost:3000), BOTS_ORIGIN (a trusted origin), SMOKE_MAILPIT_URL, ADMIN_EMAIL/ADMIN_PASSWORD (from .env).
 * Writes data: only run it against a local or throwaway database.
 */

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  /* rely on the environment */
}

const API = `${(process.env.BOTS_API ?? "http://localhost:4000").replace(/\/+$/, "")}/api/v1`;
const WEB = (process.env.BOTS_WEB ?? "http://localhost:3000").replace(/\/+$/, "");
const MAILPIT = (process.env.SMOKE_MAILPIT_URL ?? "http://localhost:8025").replace(/\/+$/, "");
const OWNERS = Number(process.env.BOTS_OWNERS ?? 8);
const INVESTORS = Number(process.env.BOTS_INVESTORS ?? 8);
const VISITORS = Number(process.env.BOTS_VISITORS ?? 20);
const VISITOR_ROUNDS = Number(process.env.BOTS_VISITOR_ROUNDS ?? 5);
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
const ORIGIN = process.env.BOTS_ORIGIN ?? (process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")[0]?.trim() || "http://localhost:3000");
const RUN = Date.now().toString(36);

const CATEGORIES = ["Food", "Fashion", "Handicrafts", "Cosmetics", "Gadgets", "Home Décor"];
const CITIES = [["Dhanmondi", "Dhaka"], ["Agrabad", "Chattogram"], ["Zindabazar", "Sylhet"], ["Shaheb Bazar", "Rajshahi"], ["Sonadanga", "Khulna"]];
const PURPOSES = ["Buy a second oven", "Stock up for Eid", "New sewing machines", "Packaging and branding", "Delivery motorbike", "Raw materials for winter"];

// ---------------------------------------------------------------- metrics
const samples = new Map(); // "GET /path" -> [{ ms, status }]
const journeyErrors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const think = (min = 300, max = 1500) => sleep(min + Math.random() * (max - min));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Groups dynamic ids so /businesses/abc and /businesses/xyz count as one endpoint. */
const routeKey = (method, path) =>
  `${method} ${path.split("?")[0].replace(/\/(usr_|c[a-z0-9]{20,}|[0-9a-f-]{36}|[a-z0-9]{24,})[^/]*/gi, "/:id")}`;

function record(key, ms, status) {
  if (!samples.has(key)) samples.set(key, []);
  samples.get(key).push({ ms, status });
}

/** A cookie-keeping HTTP client. `ip` gives each bot its own address so per-IP limits apply per bot. */
function client(ip) {
  let cookie = "";
  return async function http(method, path, body, { base = API, raw = false } = {}) {
    const isForm = body instanceof FormData;
    const started = performance.now();
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(body && !isForm ? { "content-type": "application/json" } : {}),
          "x-forwarded-for": ip,
          // Browsers send the frontend's origin; Better Auth only accepts trusted ones.
          origin: ORIGIN,
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        redirect: "manual",
      });
    } catch (error) {
      record(routeKey(method, base === API ? path : `[web] ${path}`), performance.now() - started, 0);
      throw error;
    }
    const text = await res.text();
    record(routeKey(method, base === API ? path : `[web] ${path}`), performance.now() - started, res.status);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const line of setCookie) {
      const [pair] = line.split(";");
      const [name] = pair.split("=");
      cookie = [...cookie.split("; ").filter((c) => c && !c.startsWith(`${name}=`)), pair].join("; ");
    }
    if (raw) return { status: res.status, text };
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* HTML */
    }
    return { status: res.status, json };
  };
}

async function otpFor(email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const code = /\b(\d{6})\b/.exec(message.Text ?? message.HTML ?? "")?.[1];
      if (code) return code;
    }
    await sleep(300);
  }
  throw new Error(`No OTP email for ${email}`);
}

const PNG = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(256).fill(7)])], { type: "image/png" });
const PDF = () => new Blob([new TextEncoder().encode("%PDF-1.4\n% bot document\n")], { type: "application/pdf" });

async function upload(http, purpose, blob, name) {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", blob, name);
  const res = await http("POST", "/uploads", form);
  if (res.status !== 201) throw new Error(`upload ${purpose} → ${res.status}`);
  return res.json.data.url;
}

const must = (res, label, ok = [200, 201]) => {
  if (!ok.includes(res.status)) throw new Error(`${label} → ${res.status} ${JSON.stringify(res.json?.error ?? res.json?.message ?? "")}`);
  return res;
};

let botIp = 10;
const nextIp = () => `198.18.${Math.floor(botIp / 250)}.${(botIp++ % 250) + 1}`;

// ---------------------------------------------------------------- journeys
async function onboard(role, index) {
  const http = client(nextIp());
  const tag = `${role === "OWNER" ? "owner" : "investor"}${index}`;
  const email = `bot.${tag}.${RUN}@example.com`;
  const name = `${role === "OWNER" ? "Owner" : "Investor"} Bot ${index}`;
  must(await http("POST", "/auth/sign-up/email", { name, email, password: `Bot-${RUN}-Pass1`, signupRole: role }), "sign-up");
  must(await http("POST", "/auth/email-otp/verify-email", { email, otp: await otpFor(email) }), "verify email");
  const me = must(await http("GET", "/me"), "me");
  await think();
  const [district, city] = pick(CITIES);
  const avatar = await upload(http, "AVATAR", PNG(), "me.png");
  const profile =
    role === "OWNER"
      ? { shopName: `Bot Shop ${index} ${RUN}`, slug: `bot-shop-${index}-${RUN}`, category: pick(CATEGORIES), district, city, description: "A simulated shop created by the bot test." }
      : { minLendBdt: 10000, maxLendBdt: 200000, preferredCategories: [pick(CATEGORIES)], district, city, bio: "Simulated investor." };
  must(await http("PATCH", "/me", { image: avatar, profile }), "profile");
  await think();
  const idDocumentUrl = await upload(http, "ID_DOCUMENT", PDF(), "nid.pdf");
  const salesProofUrls = role === "OWNER" ? [await upload(http, "SALES_PROOF", PDF(), "sales.pdf")] : [];
  const verification = must(await http("POST", "/verifications", { type: role, idDocumentUrl, salesProofUrls, shopLinks: [] }), "verification");
  return { http, id: me.json.data.user.id, verificationId: verification.json.data.id, name };
}

async function ownerJourney(bot, done) {
  const { http } = bot;
  const draft = must(
    await http("POST", "/me/loan-requests", { amountBdt: 20000 + Math.floor(Math.random() * 16) * 5000, purpose: pick(PURPOSES), fundUsage: "Simulated request from the bot test, to measure performance.", tenureDays: pick([30, 60, 90, 180]), repaymentFrequency: pick(["WEEKLY", "MONTHLY"]), proposedRatePct: String(8 + Math.floor(Math.random() * 6)) }),
    "create request",
  );
  must(await http("POST", `/me/loan-requests/${draft.json.data.id}/publish`), "publish");
  // Answer whatever arrives until investors are finished.
  while (!done.value) {
    await think(800, 2000);
    await http("GET", "/notifications/unread-count");
    const received = await http("GET", "/offers/received?limit=10");
    for (const offer of received.json?.data ?? []) {
      if (offer.status !== "PENDING" || offer.proposedBy === "OWNER") continue;
      if (Math.random() < 0.5) await http("POST", `/offers/${offer.id}/counter`, { amountBdt: offer.amountBdt, interestRatePct: String(Math.max(5, Number(offer.interestRatePct) - 1)), tenureDays: offer.tenureDays, repaymentFrequency: offer.repaymentFrequency, message: "Could we do one percent lower?" });
      else await http("POST", `/offers/${offer.id}/reject`);
    }
    const conversations = await http("GET", "/conversations?limit=5");
    for (const c of (conversations.json?.data ?? []).slice(0, 2)) {
      await http("GET", `/conversations/${c.id}/messages?limit=20`);
      if (Math.random() < 0.5) await http("POST", `/conversations/${c.id}/messages`, { body: "Thanks for reaching out! Happy to share more details." });
    }
    await http("GET", "/dashboard/owner");
  }
}

async function investorJourney(bot) {
  const { http } = bot;
  for (let round = 0; round < 4; round++) {
    await think();
    await http("GET", "/feed?limit=10");
    const list = await http("GET", `/loan-requests?limit=12${Math.random() < 0.5 ? `&category=${encodeURIComponent(pick(CATEGORIES))}` : ""}`);
    await http("GET", `/businesses?limit=12&q=${encodeURIComponent(pick(["bot", "shop", "food"]))}`);
    const requests = (list.json?.data ?? []).filter((r) => r.owner?.name?.startsWith("Owner Bot"));
    if (!requests.length) continue;
    const target = pick(requests);
    await http("GET", `/loan-requests/${target.id}`);
    await http("GET", `/profiles/${target.owner.id}`);
    await think();
    await http("POST", "/offers", { loanRequestId: target.id, amountBdt: target.amountBdt, interestRatePct: String(9 + Math.floor(Math.random() * 5)), tenureDays: target.tenureDays, repaymentFrequency: target.repaymentFrequency, message: "Interested in supporting your shop." });
    const convo = await http("POST", "/conversations", { participantId: target.owner.id });
    if (convo.json?.data?.id) await http("POST", `/conversations/${convo.json.data.id}/messages`, { body: "Hello! I sent you an offer, happy to discuss terms." });
    await http("GET", "/offers/submitted?limit=10");
    await http("GET", "/notifications?limit=10");
  }
}

async function visitorJourney() {
  const http = client(nextIp());
  for (let round = 0; round < VISITOR_ROUNDS; round++) {
    await http("GET", "/", undefined, { base: WEB, raw: true });
    await think(200, 800);
    const list = await http("GET", "/loan-requests?limit=12");
    await http("GET", "/businesses?limit=12");
    await http("GET", "/investors?limit=12");
    const any = pick(list.json?.data ?? []);
    if (any) {
      await http("GET", `/loan-requests/${any.id}`);
      await http("GET", `/profiles/${any.owner.id}`);
    }
    await http("GET", "/login", undefined, { base: WEB, raw: true });
    await http("GET", "/signup", undefined, { base: WEB, raw: true });
    await think(200, 800);
  }
}

// ---------------------------------------------------------------- report
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

function report(wallMs) {
  const rows = [...samples.entries()]
    .map(([key, list]) => {
      const ms = list.map((s) => s.ms).sort((a, b) => a - b);
      const errors = list.filter((s) => s.status === 0 || s.status >= 500).length;
      const limited = list.filter((s) => s.status === 429).length;
      return { key, n: list.length, p50: pct(ms, 50), p95: pct(ms, 95), max: ms[ms.length - 1], errors, limited };
    })
    .sort((a, b) => b.p95 - a.p95);
  const all = rows.reduce((sum, r) => sum + r.n, 0);
  const errors = rows.reduce((sum, r) => sum + r.errors, 0);
  const allMs = [...samples.values()].flat().map((s) => s.ms).sort((a, b) => a - b);

  const fmt = (n) => `${Math.round(n)}`.padStart(6);
  console.log(`\n${"Endpoint".padEnd(48)} ${"n".padStart(5)} ${"p50".padStart(6)} ${"p95".padStart(6)} ${"max".padStart(6)}  5xx  429`);
  for (const r of rows) console.log(`${r.key.slice(0, 48).padEnd(48)} ${String(r.n).padStart(5)} ${fmt(r.p50)} ${fmt(r.p95)} ${fmt(r.max)} ${String(r.errors).padStart(4)} ${String(r.limited).padStart(4)}`);
  console.log(`\nBots: ${OWNERS} owners, ${INVESTORS} investors, ${VISITORS} visitors · ${all} requests in ${(wallMs / 1000).toFixed(1)} s (${(all / (wallMs / 1000)).toFixed(1)} req/s)`);
  console.log(`Overall latency: p50 ${Math.round(pct(allMs, 50))} ms · p95 ${Math.round(pct(allMs, 95))} ms · p99 ${Math.round(pct(allMs, 99))} ms`);
  console.log(`Server errors (5xx or network): ${errors} (${((errors / all) * 100).toFixed(2)}%) · journeys that failed: ${journeyErrors.length}`);
  for (const e of journeyErrors.slice(0, 10)) console.log(`  - ${e}`);
  return { rows, all, errors, wallMs, p50: pct(allMs, 50), p95: pct(allMs, 95), p99: pct(allMs, 99) };
}

// ---------------------------------------------------------------- main
async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL/ADMIN_PASSWORD (or SMOKE_ADMIN_*) so bots can be approved");
  const started = performance.now();
  const admin = client(nextIp());
  must(await admin("POST", "/auth/sign-in/email", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }), "admin sign-in");

  console.log(`Onboarding ${OWNERS} owners and ${INVESTORS} investors in parallel…`);
  const settle = async (label, task) => {
    try {
      return await task();
    } catch (error) {
      journeyErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const visitorRun = Promise.all(Array.from({ length: VISITORS }, (_, i) => settle(`visitor ${i}`, visitorJourney)));
  const bots = await Promise.all([
    ...Array.from({ length: OWNERS }, (_, i) => settle(`owner ${i}`, () => onboard("OWNER", i))),
    ...Array.from({ length: INVESTORS }, (_, i) => settle(`investor ${i}`, () => onboard("INVESTOR", i))),
  ]);
  const owners = bots.slice(0, OWNERS).filter(Boolean);
  const investors = bots.slice(OWNERS).filter(Boolean);

  console.log("Admin reviewing verifications…");
  for (const bot of [...owners, ...investors]) {
    await settle(`approve ${bot.name}`, async () => must(await admin("POST", `/admin/verifications/${bot.verificationId}`, { status: "APPROVED", reviewNote: "Bot test" }), "approve"));
  }

  console.log("Owners publishing, investors browsing and making offers…");
  const done = { value: false };
  const ownerRun = Promise.all(owners.map((bot) => settle(`owner journey ${bot.name}`, () => ownerJourney(bot, done))));
  await Promise.all(investors.map((bot) => settle(`investor journey ${bot.name}`, () => investorJourney(bot))));
  done.value = true;
  await Promise.all([ownerRun, visitorRun]);
  await admin("GET", "/admin/stats");
  await admin("GET", "/admin/audit-logs?limit=50");

  const summary = report(performance.now() - started);
  if (summary.errors > 0 || journeyErrors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
