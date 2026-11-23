#!/usr/bin/env node
/**
 * End-to-end smoke test against a running local backend. Every run creates
 * brand-new users, so it can be repeated without resetting the database:
 *
 *   docker compose up -d && pnpm dev --port 4000    (one terminal)
 *   pnpm smoke                                       (another)
 *
 * Walks the real journey — sign up, verify email via the OTP in Mailpit,
 * complete a profile, upload documents, get verified by the seeded admin,
 * publish a loan request, negotiate, sign the agreement, repay — and probes
 * access control, validation, sanitisation, uploads, rate limits and headers.
 * It writes data, so only point it at a local or throwaway database.
 */

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const MAILPIT = (process.env.SMOKE_MAILPIT_URL ?? "http://localhost:8025").replace(/\/+$/, "");
const API = `${BASE}/api/v1`;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "Password123!";
const RUN = Date.now().toString(36);

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(detail ? `${name} — ${detail}` : name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const section = (title) => console.log(`\n${title}`);
const brief = (res) => `${res.status} ${JSON.stringify(res.json?.error ?? "")}`;

/** HTTP client with its own cookie jar (one per simulated user). */
function client() {
  const jar = new Map();
  return async function request(method, path, body) {
    const headers = { Origin: BASE };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      redirect: "manual",
    });
    for (const cookie of res.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(";");
      const i = pair.indexOf("=");
      const value = pair.slice(i + 1);
      if (value) jar.set(pair.slice(0, i), value);
      else jar.delete(pair.slice(0, i));
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    return { status: res.status, json, headers: res.headers, text };
  };
}

async function signIn(email, password = DEMO_PASSWORD) {
  const http = client();
  const res = await http("POST", "/auth/sign-in/email", { email, password });
  if (res.status !== 200) throw new Error(`Sign-in failed for ${email}: ${brief(res)}`);
  return { http, res, user: res.json?.user };
}

/** Reads the newest six-digit code sent to `email` from Mailpit. */
async function otpFor(email) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    const id = search.messages?.[0]?.ID;
    if (id) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
      const code = /\b(\d{6})\b/.exec(`${message.Text ?? ""} ${message.HTML ?? ""}`)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No OTP email reached Mailpit for ${email}`);
}

const PDF = () => new Blob([new TextEncoder().encode("%PDF-1.4\n% smoke test document\n")], { type: "application/pdf" });
const PNG = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)])], { type: "image/png" });

async function upload(http, purpose, blob, name) {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", blob, name);
  return http("POST", "/uploads", form);
}

/** Sign up → OTP → verified session. */
async function register(role, name) {
  const email = `smoke.${role.toLowerCase()}.${RUN}@example.com`;
  const password = `Smoke-${RUN}-Pass1`;
  const http = client();
  const signUp = await http("POST", "/auth/sign-up/email", { name, email, password, signupRole: role });
  check(`${role.toLowerCase()} can sign up`, signUp.status === 200, brief(signUp));
  check(`${role.toLowerCase()} sign-up response hides the session token`, signUp.json?.token === undefined);
  const early = await client()("POST", "/auth/sign-in/email", { email, password });
  check(`${role.toLowerCase()} can't sign in before verifying email`, early.status === 403, brief(early));
  const verify = await http("POST", "/auth/email-otp/verify-email", { email, otp: await otpFor(email) });
  check(`${role.toLowerCase()} verifies email with the OTP`, verify.status === 200, brief(verify));
  const me = await http("GET", "/me");
  check(`${role.toLowerCase()} is signed in after verifying`, me.status === 200 && me.json?.data?.user?.role === role, brief(me));
  return { http, email, id: me.json?.data?.user?.id };
}

async function main() {
  section("System");
  const health = await client()("GET", "/health");
  check("health reports database connected", health.json?.data?.database === "connected", brief(health));
  for (const header of ["x-content-type-options", "x-frame-options", "referrer-policy"]) {
    check(`security header ${header}`, Boolean(health.headers.get(header)));
  }
  check("no X-Powered-By header", !health.headers.get("x-powered-by"));

  section("Sign-up and authentication");
  const owner = await register("OWNER", "Smoke Owner");
  const investor = await register("INVESTOR", "Smoke Investor");
  const admin = await signIn("admin@smeconnect.local");
  const outsider = await signIn("investor02@smeconnect.local");
  check("seeded sign-in hides the session token", admin.res.json?.token === undefined);
  const asAdmin = await client()("POST", "/auth/sign-up/email", { name: "Mallory", email: `mallory.${RUN}@example.com`, password: "Password123!", signupRole: "ADMIN" });
  check("can't self-register as ADMIN", asAdmin.status >= 400 && asAdmin.status < 500, brief(asAdmin));
  check("protected routes need a session", (await client()("GET", "/me")).status === 401);

  section("Profiles");
  const ownerProfile = await owner.http("PATCH", "/me", {
    profile: { shopName: `Smoke Bakery ${RUN}`, slug: `smoke-bakery-${RUN}`, category: "Food", district: "Dhanmondi", city: "Dhaka", description: "Fresh <b>bread</b> daily." },
  });
  check("owner completes business profile", ownerProfile.status === 200, brief(ownerProfile));
  const investorProfile = await investor.http("PATCH", "/me", { profile: { minLendBdt: 10000, maxLendBdt: 200000, preferredCategories: ["Food"] } });
  check("investor completes lending profile", investorProfile.status === 200, brief(investorProfile));
  const badPhone = await owner.http("POST", "/phone-otp/request", { phone: "12345" });
  check("non-Bangladeshi phone number rejected", badPhone.status === 400, brief(badPhone));

  section("Uploads and verification");
  const avatar = await upload(owner.http, "AVATAR", PNG(), "me.png");
  check("public image upload works", avatar.status === 201 && avatar.json?.data?.visibility === "public", brief(avatar));
  const spoof = await upload(owner.http, "AVATAR", new Blob(["<html><script>alert(1)</script></html>"], { type: "image/png" }), "evil.png");
  check("HTML disguised as PNG is rejected", spoof.status === 400, brief(spoof));
  const anonUpload = await upload(client(), "AVATAR", PNG(), "x.png");
  check("anonymous upload rejected", anonUpload.status === 401, brief(anonUpload));
  const idDoc = await upload(owner.http, "ID_DOCUMENT", PDF(), "nid.pdf");
  const salesProof = await upload(owner.http, "SALES_PROOF", PDF(), "sales.pdf");
  check("private document uploads work", idDoc.json?.data?.visibility === "private" && salesProof.status === 201, `${brief(idDoc)} / ${brief(salesProof)}`);
  const docUrl = idDoc.json?.data?.url;
  check("another member can't read it", (await outsider.http("GET", docUrl.replace("/api/v1", ""))).status === 403);
  check("anonymous visitor can't read it", (await client()("GET", docUrl.replace("/api/v1", ""))).status === 401);

  const ownerVerification = await owner.http("POST", "/verifications", { type: "OWNER", idDocumentUrl: docUrl, salesProofUrls: [salesProof.json?.data?.url], shopLinks: ["https://facebook.com/smokebakery"] });
  check("owner submits verification", ownerVerification.status === 201, brief(ownerVerification));
  // Private files become readable once attached to the owner's verification.
  check("owner can read their own submitted document", (await owner.http("GET", docUrl.replace("/api/v1", ""))).status === 200);
  const investorDoc = await upload(investor.http, "ID_DOCUMENT", PDF(), "nid.pdf");
  const investorVerification = await investor.http("POST", "/verifications", { type: "INVESTOR", idDocumentUrl: investorDoc.json?.data?.url });
  check("investor submits verification", investorVerification.status === 201, brief(investorVerification));
  check("non-admin can't review verifications", (await owner.http("POST", `/admin/verifications/${ownerVerification.json?.data?.id}`, { status: "APPROVED" })).status === 403);
  for (const [label, v] of [["owner", ownerVerification], ["investor", investorVerification]]) {
    const review = await admin.http("POST", `/admin/verifications/${v.json?.data?.id}`, { status: "APPROVED", reviewNote: "Documents checked" });
    check(`admin approves ${label}`, review.status === 200, brief(review));
  }

  section("Loan request");
  const draft = await owner.http("POST", "/me/loan-requests", { amountBdt: 50000, purpose: "Second oven", fundUsage: "Buy a second deck oven to double festive output.", tenureDays: 90, repaymentFrequency: "MONTHLY", proposedRatePct: "12" });
  check("owner creates a draft", draft.status === 201, brief(draft));
  const loanRequestId = draft.json?.data?.id;
  const hidden = await client()("GET", `/loan-requests/${loanRequestId}`);
  check("drafts aren't public", hidden.status === 404, brief(hidden));
  const publish = await owner.http("POST", `/me/loan-requests/${loanRequestId}/publish`);
  check("owner publishes", publish.status === 200 && publish.json?.data?.status === "OPEN", brief(publish));
  check("published request is public", (await client()("GET", `/loan-requests/${loanRequestId}`)).status === 200);
  const second = await owner.http("POST", "/me/loan-requests", { amountBdt: 20000, purpose: "Another", fundUsage: "Should not be publishable alongside the first.", tenureDays: 30, repaymentFrequency: "WEEKLY", proposedRatePct: "10" });
  const secondPublish = await owner.http("POST", `/me/loan-requests/${second.json?.data?.id}/publish`);
  check("only one active request per owner", secondPublish.status >= 400, brief(secondPublish));

  section("Discovery and filtering");
  const food = await client()("GET", "/businesses?category=food&location=dhaka&limit=50");
  check("category + location filter works", food.status === 200 && food.json.data.every((b) => b.category === "Food"), brief(food));
  check("new verified business is discoverable", food.json?.data?.some((b) => b.id === owner.id));
  const listings = JSON.stringify(food.json) + JSON.stringify((await client()("GET", "/loan-requests?limit=50")).json);
  check("public listings never include emails or phones", !/@(smeconnect\.local|example\.com)|\+8801/.test(listings));
  check("bad pagination returns 400, not 500", (await client()("GET", "/businesses?limit=9999")).status === 400);
  const cached = await client()("GET", "/loan-requests?limit=5");
  check("public listings are CDN-cacheable", /s-maxage=/.test(cached.headers.get("cache-control") ?? ""));

  section("Validation");
  const offerBody = { loanRequestId, amountBdt: 50000, interestRatePct: 12, tenureDays: 90, repaymentFrequency: "MONTHLY" };
  check("unknown fields rejected (no mass assignment)", (await investor.http("POST", "/offers", { ...offerBody, status: "ACCEPTED" })).status === 400);
  check("negative amount rejected", (await investor.http("POST", "/offers", { ...offerBody, amountBdt: -5 })).status === 400);
  check("owner can't offer on loans", (await owner.http("POST", "/offers", offerBody)).status === 403);

  section("Offer → counter → accept → agreement");
  const offer = await investor.http("POST", "/offers", { ...offerBody, message: "Happy to fund <script>alert(1)</script> this." });
  check("investor makes an offer", offer.status === 201, brief(offer));
  const offerId = offer.json?.data?.id;
  check("offer message sanitised", Boolean(offer.json?.data?.message) && !/<script/i.test(offer.json.data.message));
  check("outsider can't read the offer", [403, 404].includes((await outsider.http("GET", `/offers/${offerId}`)).status));
  check("proposer can't accept own offer", (await investor.http("POST", `/offers/${offerId}/accept`)).status >= 400);
  const counter = await owner.http("POST", `/offers/${offerId}/counter`, { ...offerBody, loanRequestId: undefined, interestRatePct: 11 });
  check("owner counters", counter.status === 201, brief(counter));
  const accept = await investor.http("POST", `/offers/${counter.json?.data?.id}/accept`);
  check("investor accepts the counter", accept.status === 200, brief(accept));
  const loanId = accept.json?.data?.loanId;
  const loan = await owner.http("GET", `/loans/${loanId}`);
  const agreementId = loan.json?.data?.agreement?.id ?? loan.json?.data?.agreementId;
  check("loan links to an agreement", Boolean(agreementId), brief(loan));
  check("outsider can't read the loan", [403, 404].includes((await outsider.http("GET", `/loans/${loanId}`)).status));
  check("outsider can't confirm the agreement", (await outsider.http("POST", `/agreements/${agreementId}/confirm`)).status >= 400);
  const c1 = await owner.http("POST", `/agreements/${agreementId}/confirm`);
  const c2 = await investor.http("POST", `/agreements/${agreementId}/confirm`);
  check("both parties confirm", c1.status === 200 && c2.status === 200, `${brief(c1)} / ${brief(c2)}`);

  section("Repayments");
  const schedule = await owner.http("GET", `/repayments?loanId=${loanId}`);
  check("repayment schedule created", schedule.json?.data?.length > 0, brief(schedule));
  const first = schedule.json?.data?.[0];
  check("investor can't mark paid", (await investor.http("POST", `/repayments/${first?.id}/mark-paid`, {})).status >= 400);
  const paid = await owner.http("POST", `/repayments/${first?.id}/mark-paid`, { note: "Paid via bKash" });
  check("owner marks instalment paid", paid.status === 200, brief(paid));
  const confirmed = await investor.http("POST", `/repayments/${first?.id}/confirm`, {});
  check("investor confirms receipt", confirmed.status === 200, brief(confirmed));

  section("Messaging and notifications");
  const conversation = await investor.http("POST", "/conversations", { participantId: owner.id });
  check("conversation opened", [200, 201].includes(conversation.status), brief(conversation));
  const conversationId = conversation.json?.data?.id;
  const sent = await investor.http("POST", `/conversations/${conversationId}/messages`, { body: "Hello <img src=x onerror=alert(1)>" });
  check("message sent and HTML stripped", sent.status === 201 && !/<img/i.test(sent.json?.data?.body ?? "<img"), brief(sent));
  check("outsider can't read the conversation", [403, 404].includes((await outsider.http("GET", `/conversations/${conversationId}/messages`)).status));
  const unread = await owner.http("GET", "/notifications/unread-count");
  check("owner has notifications from the deal", unread.status === 200 && (unread.json?.data?.count ?? unread.json?.data?.unread ?? 0) > 0, brief(unread));

  section("Administration");
  check("non-admin blocked from admin API", (await investor.http("GET", "/admin/stats")).status === 403);
  check("admin reads stats", (await admin.http("GET", "/admin/stats")).status === 200);

  section("Rate limiting");
  const attacker = client();
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) {
    limited = (await attacker("POST", "/auth/sign-in/email", { email: `nobody.${RUN}@example.com`, password: "wrong-password" })).status === 429;
  }
  check("repeated failed sign-ins are rate limited", limited);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
