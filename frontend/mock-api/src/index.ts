import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { z, ZodError } from "zod";
import { config } from "./config.ts";
import { openDatabase, saveNow } from "./db.ts";
import { purgeExpiredSessions, readSession, requireAuth } from "./auth.ts";
import { fail, logger, ok } from "./http.ts";
import { authRouter } from "./routes/auth.ts";
import { profilesRouter } from "./routes/profiles.ts";
import { loansRouter } from "./routes/loans.ts";
import { messagesRouter } from "./routes/messages.ts";
import { communityRouter } from "./routes/community.ts";
import { seed } from "./seed.ts";

const { isNew } = await openDatabase();
const seeded = await seed();
if (isNew || seeded) {
  saveNow();
  logger.info("Database seeded", { seeded, dbPath: config.dbPath });
}
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", false);

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

// CSRF defense: JSON required on all state-changing writes paired with SameSite=Lax cookies.
app.use((req, res, next) => {
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (isWrite && !req.is("application/json")) {
    fail(res, 415, "UNSUPPORTED_MEDIA_TYPE", "Send requests as application/json.");
    return;
  }
  next();
});

// Unified canonical base path: /api/v1
app.get("/api/v1/health", (_req, res) =>
  ok(res, { status: "ok", database: "sqlite-mock", timestamp: new Date().toISOString() }),
);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", requireAuth, profilesRouter);
app.use("/api/v1", requireAuth, loansRouter);
app.use("/api/v1", requireAuth, messagesRouter);
app.use("/api/v1", requireAuth, communityRouter);

app.use("/api", (_req, res) => fail(res, 404, "NOT_FOUND", "Endpoint not found."));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    fail(res, 400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request.", {
      fieldErrors: z.flattenError(error).fieldErrors,
    });
    return;
  }
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 0;
  if (status >= 400 && status < 500) {
    const type = (error as { type?: string }).type;
    const code = type === "entity.too.large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR";
    const message =
      type === "entity.too.large"
        ? "Request body is too large."
        : type === "entity.parse.failed"
          ? "Request body is not valid JSON."
          : "Bad request.";
    fail(res, status, code, message);
    return;
  }
  if (error instanceof URIError) {
    fail(res, 400, "VALIDATION_ERROR", "Malformed URL.");
    return;
  }
  logger.error("Unhandled mock-api error", { error: error instanceof Error ? error.message : String(error) });
  fail(res, 500, "INTERNAL_ERROR", "Something went wrong on our side.");
});

const server = app.listen(config.port, () => {
  logger.info("SME Connect API listening", { url: `http://localhost:${config.port}`, basePath: "/api/v1" });
});

function shutdown() {
  saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
