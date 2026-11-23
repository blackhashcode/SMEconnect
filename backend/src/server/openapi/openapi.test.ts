import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import {
  ADMIN_COMMENT_PATH,
  ADMIN_COMMENTS_PATH,
  ADMIN_PATHS,
  ADMIN_POST_PATH,
  ADMIN_POSTS_PATH,
  ADMIN_REPORT_DISMISS_PATH,
  ADMIN_REPORT_PATH,
  ADMIN_REPORT_RESOLVE_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_STATS_PATH,
  ADMIN_USER_PATH,
  ADMIN_USER_REACTIVATE_PATH,
  ADMIN_USER_SUSPEND_PATH,
  ADMIN_USERS_PATH,
} from "@/server/openapi/routes/admin";
import {
  BETTER_AUTH_SESSION_COOKIE,
  API_TAGS,
  SECURITY_SCHEME_NAME,
  isApiDocsEnabled,
} from "@/server/openapi/config";
import { generateOpenApiDocument } from "@/server/openapi/document";
import {
  AUTH_PATHS,
  GET_SESSION_PATH,
  SIGN_UP_EMAIL_PATH,
  UPDATE_USER_PATH,
} from "@/server/openapi/routes/auth";
import { DISCOVERY_PATHS } from "@/server/openapi/routes/discovery";
import { HEALTH_OPERATION_ID, HEALTH_PATH } from "@/server/openapi/routes/health";
import { LOAN_REQUEST_PATHS } from "@/server/openapi/routes/loan-requests";
import { MESSAGING_PATHS } from "@/server/openapi/routes/messaging";
import { AGREEMENT_PATHS, OFFER_PATHS } from "@/server/openapi/routes/offers";
import {
  BLOCKS_PATH,
  INVESTOR_DASHBOARD_PATH,
  NOTIFICATIONS_PATH,
  NOTIFICATIONS_READ_ALL_PATH,
  NOTIFICATIONS_UNREAD_COUNT_PATH,
  NOTIFICATION_READ_PATH,
  OWNER_DASHBOARD_PATH,
  PHASE9_PATHS,
  REPORTS_PATH,
  REVIEWS_PATH,
} from "@/server/openapi/routes/phase9";
import { SOCIAL_PATHS } from "@/server/openapi/routes/social";
import { PHONE_OTP_PATHS } from "@/server/openapi/routes/phone-otp";
import { PROFILE_PATHS } from "@/server/openapi/routes/profiles";
import { LOAN_PATHS, REPAYMENT_PATHS } from "@/server/openapi/routes/repayments";
import { STORAGE_PATHS } from "@/server/openapi/routes/storage";
import {
  ADMIN_VERIFICATION_REVIEW_PATH,
  VERIFICATION_PATHS,
} from "@/server/openapi/routes/verification";
import {
  adminCommentListSuccessEnvelopeSchema,
  adminDeleteResultSuccessEnvelopeSchema,
  adminModerationActionSuccessEnvelopeSchema,
  adminPostListSuccessEnvelopeSchema,
  adminReportDetailSuccessEnvelopeSchema,
  adminReportListSuccessEnvelopeSchema,
  adminReportResolutionSuccessEnvelopeSchema,
  adminStatsSuccessEnvelopeSchema,
  adminUserDetailSuccessEnvelopeSchema,
  adminUserListSuccessEnvelopeSchema,
  adminUserStatusResultSuccessEnvelopeSchema,
  adminVerificationDetailSuccessEnvelopeSchema,
  authErrorSchema,
  blockListSuccessEnvelopeSchema,
  blockSuccessEnvelopeSchema,
  errorEnvelopeSchema,
  healthSuccessEnvelopeSchema,
  investorDashboardSuccessEnvelopeSchema,
  notificationListSuccessEnvelopeSchema,
  notificationMarkAllReadSuccessEnvelopeSchema,
  notificationMarkReadSuccessEnvelopeSchema,
  ownerDashboardSuccessEnvelopeSchema,
  paginationQuerySchema,
  reportListSuccessEnvelopeSchema,
  reportSuccessEnvelopeSchema,
  reviewListSuccessEnvelopeSchema,
  reviewSuccessEnvelopeSchema,
  successEnvelope,
  unblockSuccessEnvelopeSchema,
  unreadNotificationCountSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";
import { healthStatusSchema } from "@/server/validators/health";

interface OperationLike {
  operationId?: string;
  tags?: string[];
  summary?: string;
  security?: unknown[];
  requestBody?: unknown;
  responses: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: unknown; example?: unknown }>;
      $ref?: string;
    }
  >;
}

interface OpenApiLike {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string }>;
  tags?: Array<{ name: string }>;
  paths?: Record<string, Record<string, OperationLike>>;
  components?: {
    schemas?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    responses?: Record<string, unknown>;
    securitySchemes?: Record<
      string,
      { type?: string; in?: string; name?: string; description?: string }
    >;
  };
}

function generate(): OpenApiLike {
  return generateOpenApiDocument({
    serverUrl: "http://localhost:3000",
  }) as unknown as OpenApiLike;
}

function collectRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return refs;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") refs.push(child);
      else collectRefs(child, refs);
    }
  }

  return refs;
}

function resolveRef(document: OpenApiLike, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;

  let current: unknown = document;
  for (const segment of ref.slice(2).split("/")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenAPI document generation", () => {
  it("generates an OpenAPI 3.1 document with metadata, tags and a live server URL", () => {
    const document = generate();

    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBe("SME Connect API");
    expect(document.info.version).toBe("0.1.0");
    expect(document.servers?.[0]?.url).toBe("http://localhost:3000");
    expect(document.tags?.map((tag) => tag.name)).toEqual(
      API_TAGS.map((tag) => tag.name),
    );
  });

  it("enables docs locally and respects explicit production overrides", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_DOCS_ENABLED", "");
    expect(isApiDocsEnabled()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(isApiDocsEnabled()).toBe(false);

    vi.stubEnv("API_DOCS_ENABLED", "true");
    expect(isApiDocsEnabled()).toBe(true);
  });

  it("is structurally valid: unique operations, described responses and resolvable refs", () => {
    const document = generate();
    const operationIds: string[] = [];

    for (const path of Object.values(document.paths ?? {})) {
      for (const operation of Object.values(path)) {
        if (operation.operationId) operationIds.push(operation.operationId);
        for (const response of Object.values(operation.responses)) {
          if (response.$ref) continue;
          expect(response.description).toBeTypeOf("string");
        }
      }
    }

    expect(new Set(operationIds).size).toBe(operationIds.length);

    const refs = collectRefs(document);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of new Set(refs)) {
      expect(resolveRef(document, ref), `Unresolved ref: ${ref}`).toBeDefined();
    }
  });

  it("registers reusable error, pagination and security components", () => {
    const document = generate();

    expect(document.components?.schemas?.ErrorEnvelope).toBeDefined();
    expect(document.components?.schemas?.PaginationMeta).toBeDefined();
    expect(document.components?.schemas?.PaginationQuery).toBeDefined();
    expect(document.components?.parameters?.IdPathParam).toBeDefined();
    expect(document.components?.responses?.ValidationErrorResponse).toBeDefined();
    expect(document.components?.responses?.DatabaseUnavailableResponse).toBeDefined();
    expect(document.components?.responses?.AuthErrorResponse).toBeDefined();
  });
});

describe("health endpoint documentation", () => {
  it("documents only the implemented Phase 0–10 routes", () => {
    const document = generate();

    expect(Object.keys(document.paths ?? {})).toEqual([
      HEALTH_PATH,
      ...AUTH_PATHS,
      ...PHONE_OTP_PATHS,
      ...PROFILE_PATHS,
      ...LOAN_REQUEST_PATHS,
      ...STORAGE_PATHS,
      ...VERIFICATION_PATHS,
      ...SOCIAL_PATHS,
      ...DISCOVERY_PATHS,
      ...MESSAGING_PATHS,
      ...OFFER_PATHS,
      ...AGREEMENT_PATHS,
      ...REPAYMENT_PATHS,
      ...LOAN_PATHS,
      ...PHASE9_PATHS,
      ...ADMIN_PATHS,
    ]);
    expect(document.paths?.[HEALTH_PATH]?.get).toBeDefined();
  });

  it("documents the public GET operation with 200 and 503 responses", () => {
    const document = generate();
    const operation = document.paths?.[HEALTH_PATH]?.get;

    expect(operation?.operationId).toBe(HEALTH_OPERATION_ID);
    expect(operation?.tags).toEqual(["Health"]);
    expect(operation?.summary).toBe("Check API and database connectivity");
    expect(operation?.security).toEqual([]);
    expect(operation?.requestBody).toBeUndefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual(["200", "503"]);
    expect(operation?.responses[503]?.$ref).toBe(
      "#/components/responses/DatabaseUnavailableResponse",
    );
  });

  it("uses examples that match the documented schemas", () => {
    const document = generate();
    const operation = document.paths?.[HEALTH_PATH]?.get;

    const successExample =
      operation?.responses[200]?.content?.["application/json"]?.example;
    expect(healthSuccessEnvelopeSchema.safeParse(successExample).success).toBe(true);

    const errorExample = (
      document.components?.responses?.DatabaseUnavailableResponse as
        | { content?: Record<string, { example?: unknown }> }
        | undefined
    )?.content?.["application/json"]?.example;
    expect(errorEnvelopeSchema.safeParse(errorExample).success).toBe(true);
    expect(errorExample).toMatchObject({
      error: { code: "DATABASE_UNAVAILABLE" },
    });
  });

  it("matches the actual health route handler file", () => {
    const routePath = fileURLToPath(
      new URL("../../app/api/v1/health/route.ts", import.meta.url),
    );
    const source = readFileSync(routePath, "utf8");

    expect(source).toContain("export async function GET");
    expect(generate().paths?.[HEALTH_PATH]?.get).toBeDefined();
  });
});

describe("Phase 9 endpoint documentation", () => {
  it("documents every review/report/notification/block/dashboard operation", () => {
    const document = generate();
    const expected: Record<string, string[]> = {
      [REVIEWS_PATH]: ["get", "post"],
      [`${REVIEWS_PATH}/{reviewId}`]: ["get"],
      [REPORTS_PATH]: ["get", "post"],
      [NOTIFICATIONS_PATH]: ["get"],
      [NOTIFICATIONS_UNREAD_COUNT_PATH]: ["get"],
      [NOTIFICATIONS_READ_ALL_PATH]: ["patch"],
      [NOTIFICATION_READ_PATH]: ["patch"],
      [BLOCKS_PATH]: ["get", "post"],
      [`${BLOCKS_PATH}/{userId}`]: ["delete"],
      [OWNER_DASHBOARD_PATH]: ["get"],
      [INVESTOR_DASHBOARD_PATH]: ["get"],
    };

    for (const [path, methods] of Object.entries(expected)) {
      expect(Object.keys(document.paths?.[path] ?? {}), path).toEqual(methods);
    }

    expect(document.paths?.[REVIEWS_PATH]?.get?.security).toEqual([]);
    expect(document.paths?.[REVIEWS_PATH]?.post?.security).toEqual([
      { [SECURITY_SCHEME_NAME]: [] },
    ]);
    expect(document.paths?.[OWNER_DASHBOARD_PATH]?.get?.tags).toEqual(["Dashboards"]);
    expect(document.paths?.[NOTIFICATION_READ_PATH]?.patch?.operationId).toBe(
      "markNotificationRead",
    );
  });

  it("uses success examples that match their Phase 9 response schemas", () => {
    const document = generate();
    const exampleFor = (path: string, method: string) =>
      document.paths?.[path]?.[method]?.responses?.[
        method === "post" ? "201" : "200"
      ]?.content?.["application/json"]?.example;

    const cases = [
      [REVIEWS_PATH, "get", reviewListSuccessEnvelopeSchema],
      [REVIEWS_PATH, "post", reviewSuccessEnvelopeSchema],
      [`${REVIEWS_PATH}/{reviewId}`, "get", reviewSuccessEnvelopeSchema],
      [REPORTS_PATH, "get", reportListSuccessEnvelopeSchema],
      [REPORTS_PATH, "post", reportSuccessEnvelopeSchema],
      [NOTIFICATIONS_PATH, "get", notificationListSuccessEnvelopeSchema],
      [NOTIFICATIONS_UNREAD_COUNT_PATH, "get", unreadNotificationCountSuccessEnvelopeSchema],
      [NOTIFICATION_READ_PATH, "patch", notificationMarkReadSuccessEnvelopeSchema],
      [NOTIFICATIONS_READ_ALL_PATH, "patch", notificationMarkAllReadSuccessEnvelopeSchema],
      [BLOCKS_PATH, "get", blockListSuccessEnvelopeSchema],
      [BLOCKS_PATH, "post", blockSuccessEnvelopeSchema],
      [`${BLOCKS_PATH}/{userId}`, "delete", unblockSuccessEnvelopeSchema],
      [OWNER_DASHBOARD_PATH, "get", ownerDashboardSuccessEnvelopeSchema],
      [INVESTOR_DASHBOARD_PATH, "get", investorDashboardSuccessEnvelopeSchema],
    ] as const;

    for (const [path, method, schema] of cases) {
      expect(schema.safeParse(exampleFor(path, method)).success, `${method} ${path}`).toBe(true);
    }
  });
});

describe("Phase 10 endpoint documentation", () => {
  it("documents every admin operation with ADMIN-only session security", () => {
    const document = generate();
    const expected: Record<string, string[]> = {
      [ADMIN_USERS_PATH]: ["get"],
      [ADMIN_USER_PATH]: ["get"],
      [ADMIN_USER_SUSPEND_PATH]: ["post"],
      [ADMIN_USER_REACTIVATE_PATH]: ["post"],
      [ADMIN_REPORTS_PATH]: ["get"],
      [ADMIN_REPORT_PATH]: ["get"],
      [ADMIN_REPORT_RESOLVE_PATH]: ["post"],
      [ADMIN_REPORT_DISMISS_PATH]: ["post"],
      [ADMIN_POSTS_PATH]: ["get"],
      [ADMIN_POST_PATH]: ["delete"],
      [ADMIN_COMMENTS_PATH]: ["get"],
      [ADMIN_COMMENT_PATH]: ["delete"],
      [ADMIN_STATS_PATH]: ["get"],
      [ADMIN_VERIFICATION_REVIEW_PATH]: ["get", "post"],
    };

    for (const [path, methods] of Object.entries(expected)) {
      expect(Object.keys(document.paths?.[path] ?? {}), path).toEqual(methods);
      for (const method of methods) {
        expect(document.paths?.[path]?.[method]?.tags, `${method} ${path}`).toEqual([
          "Administration",
        ]);
        expect(document.paths?.[path]?.[method]?.security, `${method} ${path}`).toEqual([
          { [SECURITY_SCHEME_NAME]: [] },
        ]);
      }
    }
  });

  it("uses success examples that match their admin response schemas", () => {
    const document = generate();
    const exampleFor = (path: string, method: string) =>
      document.paths?.[path]?.[method]?.responses?.[200]?.content?.["application/json"]?.example;

    const cases = [
      [ADMIN_USERS_PATH, "get", adminUserListSuccessEnvelopeSchema],
      [ADMIN_USER_PATH, "get", adminUserDetailSuccessEnvelopeSchema],
      [ADMIN_USER_SUSPEND_PATH, "post", adminUserStatusResultSuccessEnvelopeSchema],
      [ADMIN_USER_REACTIVATE_PATH, "post", adminUserStatusResultSuccessEnvelopeSchema],
      [ADMIN_REPORTS_PATH, "get", adminReportListSuccessEnvelopeSchema],
      [ADMIN_REPORT_PATH, "get", adminReportDetailSuccessEnvelopeSchema],
      [ADMIN_REPORT_RESOLVE_PATH, "post", adminModerationActionSuccessEnvelopeSchema],
      [ADMIN_REPORT_DISMISS_PATH, "post", adminReportResolutionSuccessEnvelopeSchema],
      [ADMIN_POSTS_PATH, "get", adminPostListSuccessEnvelopeSchema],
      [ADMIN_POST_PATH, "delete", adminDeleteResultSuccessEnvelopeSchema],
      [ADMIN_COMMENTS_PATH, "get", adminCommentListSuccessEnvelopeSchema],
      [ADMIN_COMMENT_PATH, "delete", adminDeleteResultSuccessEnvelopeSchema],
      [ADMIN_STATS_PATH, "get", adminStatsSuccessEnvelopeSchema],
      [ADMIN_VERIFICATION_REVIEW_PATH, "get", adminVerificationDetailSuccessEnvelopeSchema],
    ] as const;

    for (const [path, method, schema] of cases) {
      expect(schema.safeParse(exampleFor(path, method)).success, `${method} ${path}`).toBe(
        true,
      );
    }
  });
});

describe("Better Auth endpoint documentation", () => {
  it("documents every enabled product auth path with its actual method", () => {
    const document = generate();

    for (const path of AUTH_PATHS) {
      const expectedMethod = path === GET_SESSION_PATH ? "get" : "post";
      const methods = Object.keys(document.paths?.[path] ?? {});

      expect(methods).toEqual([expectedMethod]);
    }
  });

  it("documents signup role restrictions and native Better Auth errors", () => {
    const document = generate();
    const signUp = document.paths?.[SIGN_UP_EMAIL_PATH]?.post;
    const requestBody = signUp?.requestBody as
      | { content?: Record<string, { schema?: { $ref?: string } }> }
      | undefined;

    expect(signUp?.tags).toEqual(["Authentication"]);
    expect(signUp?.security).toEqual([]);
    expect(signUp?.summary).toContain("OWNER or INVESTOR");
    expect(requestBody?.content?.["application/json"]?.schema?.$ref).toBe(
      "#/components/schemas/SignUpEmailRequest",
    );
    expect(document.components?.schemas?.SignupRole).toBeDefined();

    const authErrorResponse = document.components?.responses?.AuthErrorResponse as
      | { content?: Record<string, { example?: unknown }> }
      | undefined;
    expect(
      authErrorSchema.safeParse(
        authErrorResponse?.content?.["application/json"]?.example,
      ).success,
    ).toBe(true);
  });

  it("uses the session cookie for authenticated endpoints", () => {
    const document = generate();
    const expected = [{ [SECURITY_SCHEME_NAME]: [] }];

    expect(document.paths?.[GET_SESSION_PATH]?.get?.security).toEqual(expected);
    expect(document.paths?.[UPDATE_USER_PATH]?.post?.security).toEqual(expected);
  });

  it("does not document disabled token-based auth paths", () => {
    const document = generate();

    expect(document.paths?.["/api/v1/auth/verify-email"]).toBeUndefined();
    expect(document.paths?.["/api/v1/auth/reset-password"]).toBeUndefined();
  });
});

describe("Zod-backed schema definitions", () => {
  it("generates the standard success envelope", () => {
    const schema = successEnvelope(healthStatusSchema);
    const valid = {
      data: {
        status: "ok",
        database: "connected",
        timestamp: "2026-11-23T18:00:00.000Z",
      },
      meta: { requestId: "req_123" },
    };

    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ data: { status: "down" } }).success).toBe(false);
  });

  it("generates the standard error envelope with optional details", () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: "VALIDATION_ERROR", message: "Invalid input" },
      }).success,
    ).toBe(true);
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: {} },
      }).success,
    ).toBe(true);
    expect(
      errorEnvelopeSchema.safeParse({ error: { code: "VALIDATION_ERROR" } }).success,
    ).toBe(false);
  });

  it("documents cursor pagination defaults and bounds", () => {
    expect(paginationQuerySchema.parse({}).limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(paginationQuerySchema.safeParse({ limit: MAX_PAGE_LIMIT }).success).toBe(
      true,
    );
    expect(paginationQuerySchema.safeParse({ limit: MAX_PAGE_LIMIT + 1 }).success).toBe(
      false,
    );
    expect(paginationQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
  });
});

describe("Better Auth security scheme", () => {
  it("documents the real session cookie and invents no bearer mechanism", () => {
    const document = generate();

    expect(document.components?.securitySchemes?.[SECURITY_SCHEME_NAME]).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: BETTER_AUTH_SESSION_COOKIE,
    });

    const serialized = JSON.stringify(document);
    expect(serialized).not.toContain("BearerAuth");
    expect(serialized).not.toContain("Authorization: Bearer");
  });
});
