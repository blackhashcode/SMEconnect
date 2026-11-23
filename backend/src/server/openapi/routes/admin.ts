import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import { STANDARD_ERROR_RESPONSES } from "@/server/openapi/schemas";

export const ADMIN_USERS_PATH = "/api/v1/admin/users";
export const ADMIN_USER_PATH = `${ADMIN_USERS_PATH}/{userId}`;
export const ADMIN_USER_SUSPEND_PATH = `${ADMIN_USER_PATH}/suspend`;
export const ADMIN_USER_REACTIVATE_PATH = `${ADMIN_USER_PATH}/reactivate`;
export const ADMIN_REPORTS_PATH = "/api/v1/admin/reports";
export const ADMIN_REPORT_PATH = `${ADMIN_REPORTS_PATH}/{reportId}`;
export const ADMIN_REPORT_RESOLVE_PATH = `${ADMIN_REPORT_PATH}/resolve`;
export const ADMIN_REPORT_DISMISS_PATH = `${ADMIN_REPORT_PATH}/dismiss`;
export const ADMIN_POSTS_PATH = "/api/v1/admin/posts";
export const ADMIN_POST_PATH = `${ADMIN_POSTS_PATH}/{postId}`;
export const ADMIN_COMMENTS_PATH = "/api/v1/admin/comments";
export const ADMIN_COMMENT_PATH = `${ADMIN_COMMENTS_PATH}/{commentId}`;
export const ADMIN_STATS_PATH = "/api/v1/admin/stats";

export const ADMIN_PATHS = [
  ADMIN_USERS_PATH,
  ADMIN_USER_PATH,
  ADMIN_USER_SUSPEND_PATH,
  ADMIN_USER_REACTIVATE_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_REPORT_PATH,
  ADMIN_REPORT_RESOLVE_PATH,
  ADMIN_REPORT_DISMISS_PATH,
  ADMIN_POSTS_PATH,
  ADMIN_POST_PATH,
  ADMIN_COMMENTS_PATH,
  ADMIN_COMMENT_PATH,
  ADMIN_STATS_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];
const META_EXAMPLE = { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false };
const CREATED_AT = "2026-11-23T18:00:00.000Z";
const UPDATED_AT = "2026-11-23T18:30:00.000Z";

const ADMIN_USER = {
  id: "usr_123",
  name: "Nusrat Akter",
  email: "nusrat@example.test",
  role: "OWNER",
  status: "ACTIVE",
  verificationStatus: "APPROVED",
  trustScore: 82,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const ADMIN_USER_DETAIL = {
  ...ADMIN_USER,
  verifications: [
    {
      id: "ver_123",
      type: "OWNER",
      status: "APPROVED",
      reviewNote: "Documents checked",
      reviewerId: "usr_admin",
      submittedAt: CREATED_AT,
      reviewedAt: UPDATED_AT,
      idDocumentUrl: "/api/v1/files/private/id.pdf",
      salesProofUrls: ["/api/v1/files/private/sales.jpg"],
      shopLinks: ["https://www.facebook.com/shop/example"],
    },
  ],
  openReportsAgainst: 0,
};

const REPORT = {
  id: "rpt_123",
  reporterId: "usr_456",
  targetType: "POST",
  targetId: "post_123",
  reason: "Misleading sales proof",
  status: "OPEN",
  resolutionNote: null,
  handledById: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const ADMIN_REPORT_DETAIL = {
  ...REPORT,
  target: {
    targetType: "POST",
    targetId: "post_123",
    authorId: "usr_123",
    type: "UPDATE",
    content: "Fresh stock available",
    deletedAt: null,
    createdAt: CREATED_AT,
  },
};

const POST = {
  id: "post_123",
  authorId: "usr_123",
  type: "UPDATE",
  content: "Fresh stock available",
  imageUrls: [],
  deletedAt: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const COMMENT = {
  id: "cmt_123",
  postId: "post_123",
  authorId: "usr_456",
  content: "Is this still available?",
  deletedAt: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const ADMIN_STATS = {
  users: {
    total: 4,
    byRole: { OWNER: 2, INVESTOR: 1, ADMIN: 1 },
    byStatus: { ACTIVE: 3, SUSPENDED: 1 },
  },
  verifications: { total: 3, pending: 1, approved: 1, rejected: 1 },
  loanRequests: {
    total: 2,
    byStatus: {
      DRAFT: 0,
      OPEN: 1,
      IN_DISCUSSION: 0,
      FUNDED: 0,
      REPAYING: 1,
      COMPLETED: 0,
      PAUSED: 0,
      CANCELLED: 0,
    },
  },
  offers: {
    total: 2,
    byStatus: {
      PENDING: 1,
      ACCEPTED: 1,
      REJECTED: 0,
      COUNTERED: 0,
      WITHDRAWN: 0,
      EXPIRED: 0,
    },
  },
  loans: {
    fundedCount: 1,
    totalPrincipalBdt: 50_000,
    byStatus: {
      PENDING_AGREEMENT: 0,
      ACTIVE: 1,
      COMPLETED: 0,
      DEFAULTED: 0,
    },
  },
  repayments: {
    total: 13,
    confirmedCount: 2,
    onTimeConfirmedCount: 2,
    onTimeRatePct: 100,
    overdueCount: 0,
  },
  reports: {
    total: 1,
    byStatus: { OPEN: 1, RESOLVED: 0, DISMISSED: 0 },
    activeDisputes: 1,
    handledCount: 0,
  },
  moderation: { suspendedUsers: 1, removedPosts: 1, removedComments: 2 },
};

function json(schema: { $ref: string }, example: unknown) {
  return { "application/json": { schema, example } };
}

const SUCCESS_ENVELOPES: Record<string, string> = {
  AdminUserRecord: "AdminUserListSuccessEnvelope",
  AdminUserDetail: "AdminUserDetailSuccessEnvelope",
  AdminUserStatusResult: "AdminUserStatusResultSuccessEnvelope",
  ReportRecord: "AdminReportListSuccessEnvelope",
  AdminReportDetail: "AdminReportDetailSuccessEnvelope",
  AdminModerationAction: "AdminModerationActionSuccessEnvelope",
  AdminReportResolutionResult: "AdminReportResolutionSuccessEnvelope",
  AdminPostRecord: "AdminPostListSuccessEnvelope",
  AdminDeleteResult: "AdminDeleteResultSuccessEnvelope",
  AdminCommentRecord: "AdminCommentListSuccessEnvelope",
  AdminStats: "AdminStatsSuccessEnvelope",
};

function successContent(refName: string) {
  return { $ref: `#/components/schemas/${SUCCESS_ENVELOPES[refName] ?? refName}` };
}

function body(refName: string) {
  return {
    required: true,
    content: {
      "application/json": { schema: { $ref: `#/components/schemas/${refName}` } },
    },
  };
}

function pathParam(name: string, description: string) {
  return {
    name,
    in: "path" as const,
    required: true,
    schema: { type: "string" as const },
    description,
  };
}

const paginationParameters = [
  {
    name: "cursor",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const },
    description: "Opaque cursor returned by the previous page",
  },
  {
    name: "limit",
    in: "query" as const,
    required: false,
    schema: {
      type: "integer" as const,
      minimum: 1,
      maximum: MAX_PAGE_LIMIT,
      default: DEFAULT_PAGE_LIMIT,
    },
    description: `Page size (default ${DEFAULT_PAGE_LIMIT}, max ${MAX_PAGE_LIMIT})`,
  },
];

/** Registers Phase 10 admin documentation; verification admin paths live in verification.ts. */
export function registerAdminRoutes() {
  registry.registerPath({
    method: "get",
    path: ADMIN_USERS_PATH,
    operationId: "listAdminUsers",
    tags: ["Administration"],
    summary: "List user accounts",
    description: "ADMIN only. Cursor-paginated account directory with optional role/status filters.",
    security: sessionSecurity,
    parameters: [
      { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/UserStatus" } },
      { name: "role", in: "query", required: false, schema: { $ref: "#/components/schemas/Role" } },
      ...paginationParameters,
    ],
    responses: {
      200: {
        description: "User page",
        content: json(successContent("AdminUserRecord"), { data: [ADMIN_USER], meta: META_EXAMPLE }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_USER_PATH,
    operationId: "getAdminUser",
    tags: ["Administration"],
    summary: "Get one user account",
    description: "ADMIN only. Includes private verification history and open report count.",
    security: sessionSecurity,
    parameters: [pathParam("userId", "User identifier")],
    responses: {
      200: {
        description: "User detail",
        content: json(successContent("AdminUserDetail"), { data: ADMIN_USER_DETAIL }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  for (const action of ["suspend", "reactivate"] as const) {
    const suspended = action === "suspend";
    registry.registerPath({
      method: "post",
      path: suspended ? ADMIN_USER_SUSPEND_PATH : ADMIN_USER_REACTIVATE_PATH,
      operationId: suspended ? "suspendAdminUser" : "reactivateAdminUser",
      tags: ["Administration"],
      summary: suspended ? "Suspend a user account" : "Reactivate a user account",
      description:
        "ADMIN only. Self and administrator accounts are protected. Suspended users cannot use protected API routes.",
      security: sessionSecurity,
      parameters: [pathParam("userId", "User identifier")],
      responses: {
        200: {
          description: suspended ? "User suspended" : "User reactivated",
          content: json(successContent("AdminUserStatusResult"), {
            data: {
              id: "usr_123",
              status: suspended ? "SUSPENDED" : "ACTIVE",
              changedAt: UPDATED_AT,
            },
          }),
        },
        401: STANDARD_ERROR_RESPONSES[401],
        403: STANDARD_ERROR_RESPONSES[403],
        404: STANDARD_ERROR_RESPONSES[404],
        409: STANDARD_ERROR_RESPONSES[409],
        422: STANDARD_ERROR_RESPONSES[422],
      },
    });
  }

  registry.registerPath({
    method: "get",
    path: ADMIN_REPORTS_PATH,
    operationId: "listAdminReports",
    tags: ["Administration"],
    summary: "List all reports",
    description: "ADMIN only. Cursor-paginated queue with optional status and target-type filters.",
    security: sessionSecurity,
    parameters: [
      { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/ReportStatus" } },
      { name: "targetType", in: "query", required: false, schema: { $ref: "#/components/schemas/ReportTargetType" } },
      ...paginationParameters,
    ],
    responses: {
      200: {
        description: "Report page",
        content: json(successContent("ReportRecord"), { data: [REPORT], meta: META_EXAMPLE }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_REPORT_PATH,
    operationId: "getAdminReport",
    tags: ["Administration"],
    summary: "Get one report",
    description: "ADMIN only. Includes a minimal snapshot of the reported target.",
    security: sessionSecurity,
    parameters: [pathParam("reportId", "Report identifier")],
    responses: {
      200: {
        description: "Report detail",
        content: json(successContent("AdminReportDetail"), { data: ADMIN_REPORT_DETAIL }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: ADMIN_REPORT_RESOLVE_PATH,
    operationId: "resolveAdminReport",
    tags: ["Administration"],
    summary: "Resolve an open report",
    description:
      "ADMIN only. OPEN → RESOLVED. Records handler and note; optional REMOVE_CONTENT or SUSPEND_USER action. The client never sends the report status.",
    security: sessionSecurity,
    parameters: [pathParam("reportId", "Report identifier")],
    requestBody: body("ResolveReportRequest"),
    responses: {
      200: {
        description: "Resolved report and moderation action",
        content: json(successContent("AdminModerationAction"), {
          data: {
            reportId: "rpt_123",
            status: "RESOLVED",
            moderationAction: "REMOVE_CONTENT",
            resolutionNote: "Prohibited content removed",
            handledById: "usr_admin",
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "post",
    path: ADMIN_REPORT_DISMISS_PATH,
    operationId: "dismissAdminReport",
    tags: ["Administration"],
    summary: "Dismiss an open report",
    description: "ADMIN only. OPEN → DISMISSED with a required note; no moderation action is applied.",
    security: sessionSecurity,
    parameters: [pathParam("reportId", "Report identifier")],
    requestBody: body("DismissReportRequest"),
    responses: {
      200: {
        description: "Dismissed report",
        content: json(successContent("AdminReportResolutionResult"), {
          data: {
            ...REPORT,
            status: "DISMISSED",
            resolutionNote: "False report",
            handledById: "usr_admin",
            updatedAt: UPDATED_AT,
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_POSTS_PATH,
    operationId: "listAdminPosts",
    tags: ["Administration"],
    summary: "List feed posts",
    description: "ADMIN only. Hides soft-deleted posts unless `includeDeleted=true`.",
    security: sessionSecurity,
    parameters: [
      { name: "includeDeleted", in: "query", required: false, schema: { type: "string", enum: ["true", "false"] } },
      ...paginationParameters,
    ],
    responses: {
      200: {
        description: "Post page",
        content: json(successContent("AdminPostRecord"), { data: [POST], meta: META_EXAMPLE }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "delete",
    path: ADMIN_POST_PATH,
    operationId: "removeAdminPost",
    tags: ["Administration"],
    summary: "Soft-delete a post",
    description: "ADMIN only. The post and its visible comments are retained with `deletedAt` set.",
    security: sessionSecurity,
    parameters: [pathParam("postId", "Post identifier")],
    responses: {
      200: {
        description: "Post removed",
        content: json(successContent("AdminDeleteResult"), { data: { id: "post_123", deleted: true } }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_COMMENTS_PATH,
    operationId: "listAdminComments",
    tags: ["Administration"],
    summary: "List comments",
    description: "ADMIN only. Optional `postId` filter; deleted comments are hidden by default.",
    security: sessionSecurity,
    parameters: [
      { name: "postId", in: "query", required: false, schema: { type: "string" } },
      { name: "includeDeleted", in: "query", required: false, schema: { type: "string", enum: ["true", "false"] } },
      ...paginationParameters,
    ],
    responses: {
      200: {
        description: "Comment page",
        content: json(successContent("AdminCommentRecord"), { data: [COMMENT], meta: META_EXAMPLE }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "delete",
    path: ADMIN_COMMENT_PATH,
    operationId: "removeAdminComment",
    tags: ["Administration"],
    summary: "Soft-delete a comment",
    description: "ADMIN only. The row is retained with `deletedAt` set for auditability.",
    security: sessionSecurity,
    parameters: [pathParam("commentId", "Comment identifier")],
    responses: {
      200: {
        description: "Comment removed",
        content: json(successContent("AdminDeleteResult"), { data: { id: "cmt_123", deleted: true } }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "get",
    path: ADMIN_STATS_PATH,
    operationId: "getAdminStats",
    tags: ["Administration"],
    summary: "Get platform analytics",
    description:
      "ADMIN only. Aggregate totals only: users, verifications, requests, offers, loans, repayments, reports and moderation.",
    security: sessionSecurity,
    responses: {
      200: {
        description: "Platform statistics",
        content: json(successContent("AdminStats"), { data: ADMIN_STATS }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });
}
