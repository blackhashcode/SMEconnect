import "@/server/openapi/setup";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import { STANDARD_ERROR_RESPONSES } from "@/server/openapi/schemas";

export const ADMIN_OVERSIGHT_PATHS = [
  "/api/v1/admin/audit-logs",
  "/api/v1/admin/loan-requests",
  "/api/v1/admin/loan-requests/{id}/{action}",
  "/api/v1/admin/loans",
  "/api/v1/admin/users/{userId}/sessions",
  "/api/v1/admin/users/{userId}/verification-history",
  "/api/v1/me/role",
  "/api/v1/auth-options",
] as const;

const security = [{ [SECURITY_SCHEME_NAME]: [] }];
const page = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" as const, properties: { data: { type: "array" as const, items: { type: "object" as const } }, meta: { $ref: "#/components/schemas/PaginationMeta" } } } } },
});
const single = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" as const, properties: { data: { type: "object" as const } } } } },
});
const errors = { 400: STANDARD_ERROR_RESPONSES[400], 401: STANDARD_ERROR_RESPONSES[401], 403: STANDARD_ERROR_RESPONSES[403] };
const pageParams = [
  { name: "cursor", in: "query" as const, required: false, schema: { type: "string" as const } },
  { name: "limit", in: "query" as const, required: false, schema: { type: "integer" as const } },
];
const q = (name: string, description: string) => ({ name, in: "query" as const, required: false, description, schema: { type: "string" as const } });
const path = (name: string) => ({ name, in: "path" as const, required: true, schema: { type: "string" as const } });

/** Activity log, loan oversight, session revocation, role switch and auth options. */
export function registerAdminOversightRoutes() {
  registry.registerPath({
    method: "get", path: "/api/v1/admin/audit-logs", operationId: "listAuditLogs", tags: ["Administration"],
    summary: "Activity log", description: "ADMIN only. Sign-ups, sign-ins, lending events and admin actions, newest first.",
    security, parameters: [q("action", "Exact action, e.g. auth.sign_in"), q("category", "Action prefix, e.g. admin."), q("actorId", "Who did it"), q("targetId", "What it was done to"), ...pageParams],
    responses: { 200: page("Log page"), ...errors },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/admin/loan-requests", operationId: "listAdminLoanRequests", tags: ["Administration"],
    summary: "All loan requests", description: "ADMIN only. Any status, searchable by purpose, owner or shop.",
    security, parameters: [q("status", "LoanRequestStatus"), q("q", "Search text"), ...pageParams],
    responses: { 200: page("Loan request page"), ...errors },
  });
  registry.registerPath({
    method: "post", path: "/api/v1/admin/loan-requests/{id}/{action}", operationId: "moderateLoanRequest", tags: ["Administration"],
    summary: "Pause, resume or cancel a loan request", description: "ADMIN only. `action` is pause | resume | cancel. The owner is notified with the reason.",
    security, parameters: [path("id"), path("action")],
    request: { body: { content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 5, maxLength: 500 } } } } } } },
    responses: { 200: single("New status"), ...errors, 404: STANDARD_ERROR_RESPONSES[404] },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/admin/loans", operationId: "listAdminLoans", tags: ["Administration"],
    summary: "All loans", description: "ADMIN only. Parties and repayment progress for every loan.",
    security, parameters: [q("status", "LoanStatus"), ...pageParams],
    responses: { 200: page("Loan page"), ...errors },
  });
  registry.registerPath({
    method: "delete", path: "/api/v1/admin/users/{userId}/sessions", operationId: "revokeUserSessions", tags: ["Administration"],
    summary: "Sign a member out everywhere", description: "ADMIN only. Deletes every session for the member.",
    security, parameters: [path("userId")],
    responses: { 200: single("Sessions revoked"), ...errors, 404: STANDARD_ERROR_RESPONSES[404] },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/admin/users/{userId}/verification-history", operationId: "listVerificationHistory", tags: ["Administration"],
    summary: "Verification submission history", description: "ADMIN only. Every submission a member has made (documents, decision, reviewer), newest first, including ones replaced after a rejection.",
    security, parameters: [path("userId")],
    responses: { 200: page("Submission history"), ...errors },
  });
  registry.registerPath({
    method: "patch", path: "/api/v1/me/role", operationId: "switchOwnRole", tags: ["Users"],
    summary: "Switch account type", description: "OWNER ↔ INVESTOR, only while the account has no profile, verification, request or offer.",
    security,
    request: { body: { content: { "application/json": { schema: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["OWNER", "INVESTOR"] } } } } } } },
    responses: { 200: single("Role changed"), ...errors, 422: STANDARD_ERROR_RESPONSES[422] },
  });
  registry.registerPath({
    method: "get", path: "/api/v1/auth-options", operationId: "getAuthOptions", tags: ["Authentication"],
    summary: "Configured sign-in methods", description: "Public. `{ google: boolean }` so clients only show working buttons.",
    responses: { 200: single("Sign-in methods") },
  });
}
