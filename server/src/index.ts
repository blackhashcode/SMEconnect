import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { z, ZodError } from "zod";
import { config } from "./config.ts";
import { openDatabase, saveNow } from "./db.ts";
import { purgeExpiredSessions, readSession, requireAuth } from "./auth.ts";
import { authRouter } from "./routes/auth.ts";
import { profilesRouter } from "./routes/profiles.ts";
import { loansRouter } from "./routes/loans.ts";
import { messagesRouter } from "./routes/messages.ts";
import { seed } from "./seed.ts";

const { isNew } = await openDatabase();
const seeded = await seed();
if (isNew || seeded) {
  saveNow();
  console.log(`Seeded ${seeded} rows into ${config.dbPath}`);
}
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();

const app = express();
app.disable("x-powered-by");
// Don't derive client IPs from X-Forwarded-For: it's client-controlled. In
// production, rate-limit at the edge (load balancer / CDN) as well.
app.set("trust proxy", false);

// Plain-language validation messages; field-specific messages in schemas win.
z.config({
  customError: (issue) => {
    if (issue.code === "invalid_type") return issue.input === undefined || issue.input === null ? "This field is required." : issue.expected === "number" ? "Enter a number." : "This value isn't valid.";
    if (issue.code === "invalid_value") return `Choose one of: ${issue.values.join(", ")}.`;
    if (issue.code === "too_big" && issue.origin === "string") return `Keep this under ${issue.maximum} characters.`;
    if (issue.code === "too_small" && issue.origin === "string") return issue.minimum === 1 ? "This field is required." : `Use at least ${issue.minimum} characters.`;
    if (issue.code === "invalid_union") return "This value isn't valid.";
    return undefined;
  },
});
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(readSession);

// Only accept JSON for writes. Together with SameSite=Lax cookies this blocks
// cross-site form posts (CSRF) without needing a separate token.
// Every write, even one with an empty body, must declare JSON. Browsers can't send
// that cross-site without a CORS preflight (which this API never approves).
app.use((req, res, next) => {
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (isWrite && !req.is("application/json")) {
    res.status(415).json({ error: "Send requests as application/json." });
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api", requireAuth, profilesRouter);
app.use("/api", requireAuth, loansRouter);
app.use("/api", requireAuth, messagesRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Invalid request.", fields: z.flattenError(error).fieldErrors });
    return;
  }
  // body-parser errors carry an HTTP status (413 too large, 400 bad JSON, 415 charset).
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 0;
  if (status >= 400 && status < 500) {
    const type = (error as { type?: string }).type;
    const message = type === "entity.too.large" ? "Request body is too large." : type === "entity.parse.failed" ? "Request body is not valid JSON." : "Bad request.";
    res.status(status).json({ error: message });
    return;
  }
  if (error instanceof URIError) {
    res.status(400).json({ error: "Malformed URL." });
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on our side." });
});

const server = app.listen(config.port, () => {
  console.log(`SME Connect API listening on http://localhost:${config.port}`);
});

function shutdown() {
  saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
