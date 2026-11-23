import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  blockListSuccessEnvelopeSchema,
  blockSuccessEnvelopeSchema,
  investorDashboardSuccessEnvelopeSchema,
  notificationListSuccessEnvelopeSchema,
  notificationMarkAllReadSuccessEnvelopeSchema,
  notificationMarkReadSuccessEnvelopeSchema,
  ownerDashboardSuccessEnvelopeSchema,
  reportListSuccessEnvelopeSchema,
  reportSuccessEnvelopeSchema,
  reviewListSuccessEnvelopeSchema,
  reviewSuccessEnvelopeSchema,
  unblockSuccessEnvelopeSchema,
  unreadNotificationCountSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const REVIEWS_PATH = "/api/v1/reviews";
export const REVIEW_PATH = `${REVIEWS_PATH}/{reviewId}`;
export const REPORTS_PATH = "/api/v1/reports";
export const NOTIFICATIONS_PATH = "/api/v1/notifications";
export const NOTIFICATIONS_UNREAD_COUNT_PATH = `${NOTIFICATIONS_PATH}/unread-count`;
export const NOTIFICATIONS_READ_ALL_PATH = `${NOTIFICATIONS_PATH}/read-all`;
export const NOTIFICATION_READ_PATH = `${NOTIFICATIONS_PATH}/{notificationId}/read`;
export const BLOCKS_PATH = "/api/v1/blocks";
export const BLOCK_PATH = `${BLOCKS_PATH}/{userId}`;
export const OWNER_DASHBOARD_PATH = "/api/v1/dashboard/owner";
export const INVESTOR_DASHBOARD_PATH = "/api/v1/dashboard/investor";

export const PHASE9_PATHS = [
  REVIEWS_PATH,
  REVIEW_PATH,
  REPORTS_PATH,
  NOTIFICATIONS_PATH,
  NOTIFICATIONS_UNREAD_COUNT_PATH,
  NOTIFICATION_READ_PATH,
  NOTIFICATIONS_READ_ALL_PATH,
  BLOCKS_PATH,
  BLOCK_PATH,
  OWNER_DASHBOARD_PATH,
  INVESTOR_DASHBOARD_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];

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

const META_EXAMPLE = { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false };
const CREATED_AT = "2026-11-23T18:00:00.000Z";
const UPDATED_AT = "2026-11-23T18:30:00.000Z";
const DUE_AT = "2026-12-14T18:00:00.000Z";

const OWNER_AUTHOR = {
  name: "Nusrat Akter",
  image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
  role: "OWNER",
  verified: true,
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
};

const INVESTOR_AUTHOR = {
  name: "Tanvir Ahmed",
  image: null,
  role: "INVESTOR",
  verified: true,
  shopName: null,
  slug: null,
  category: null,
};

const REVIEW = {
  id: "rev_123",
  loanId: "loan_123",
  rating: 5,
  comment: "Clear communication and on-time repayment.",
  reviewer: INVESTOR_AUTHOR,
  reviewee: OWNER_AUTHOR,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const REPORT = {
  id: "rpt_123",
  reporterId: "usr_123",
  targetType: "POST",
  targetId: "post_123",
  reason: "Misleading sales proof",
  status: "OPEN",
  resolutionNote: null,
  handledById: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const NOTIFICATION = {
  id: "ntf_123",
  userId: "usr_123",
  type: "OFFER_RECEIVED",
  title: "New offer",
  body: "Tanvir sent you an offer of 50,000 BDT.",
  link: "/offers/off_123",
  data: { offerId: "off_123", amountBdt: 50_000 },
  readAt: null,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const BLOCKED_USER = {
  userId: "usr_456",
  user: INVESTOR_AUTHOR,
  blockedAt: CREATED_AT,
};

const DASHBOARD_VERIFICATION = {
  status: "APPROVED",
  submittedAt: "2026-11-13T18:00:00.000Z",
  reviewedAt: "2026-11-15T18:00:00.000Z",
};

const RECENT_NOTIFICATION = {
  id: "ntf_123",
  type: "OFFER_RECEIVED",
  title: "New offer",
  body: "Tanvir sent you an offer of 50,000 BDT.",
  link: "/offers/off_123",
  readAt: null,
  createdAt: CREATED_AT,
};

const NEXT_DUE = {
  repaymentId: "rep_1",
  installmentNo: 1,
  dueDate: DUE_AT,
  amountBdt: 3_983,
  status: "UPCOMING",
};

const DASHBOARD_PROGRESS = {
  totalInstallments: 13,
  confirmedCount: 1,
  confirmedBdt: 3_983,
  outstandingBdt: 47_805,
  progressPct: 8,
};

const DASHBOARD_LOAN = {
  id: "loan_123",
  loanRequestId: "lr_123",
  status: "ACTIVE",
  principalBdt: 50_000,
  totalRepayableBdt: 51_788,
  startDate: CREATED_AT,
  progress: DASHBOARD_PROGRESS,
  nextDue: NEXT_DUE,
};

const DASHBOARD_ACTIVITY = {
  connections: 12,
  followers: 34,
  following: 9,
  posts: 7,
  unreadNotifications: 2,
};

const OWNER_DASHBOARD = {
  profile: {
    id: "usr_123",
    name: "Nusrat Akter",
    image: OWNER_AUTHOR.image,
    role: "OWNER",
    shopName: OWNER_AUTHOR.shopName,
    slug: OWNER_AUTHOR.slug,
    category: OWNER_AUTHOR.category,
    district: "Dhaka",
    city: "Dhaka",
  },
  verification: DASHBOARD_VERIFICATION,
  trustScore: 82,
  loanRequests: {
    active: {
      id: "lr_123",
      purpose: "Buy a second oven",
      amountBdt: 50_000,
      status: "REPAYING",
      createdAt: CREATED_AT,
    },
    total: 3,
    byStatus: {
      DRAFT: 0,
      OPEN: 0,
      IN_DISCUSSION: 0,
      FUNDED: 0,
      REPAYING: 1,
      COMPLETED: 2,
      PAUSED: 0,
      CANCELLED: 0,
    },
  },
  offers: { received: 4, pendingReceived: 2, acceptedReceived: 1 },
  loan: DASHBOARD_LOAN,
  recentNotifications: [RECENT_NOTIFICATION],
  activity: DASHBOARD_ACTIVITY,
};

const INVESTOR_DASHBOARD = {
  profile: {
    id: "usr_456",
    name: "Tanvir Ahmed",
    image: null,
    role: "INVESTOR",
    shopName: null,
    slug: null,
    category: null,
    district: "Dhaka",
    city: "Dhaka",
  },
  verification: DASHBOARD_VERIFICATION,
  trustScore: 74,
  offers: { submitted: 5, pendingSubmitted: 2, acceptedSubmitted: 2 },
  loans: {
    active: 2,
    completed: 1,
    totalLentBdt: 120_000,
    repaidBdt: 47_805,
    expectedReturnsBdt: 135_000,
  },
  repayments: DASHBOARD_PROGRESS,
  nextDue: NEXT_DUE,
  portfolio: [{ ...DASHBOARD_LOAN, health: "ON_TRACK" }],
  recentNotifications: [RECENT_NOTIFICATION],
  activity: DASHBOARD_ACTIVITY,
};

function body(name: string) {
  return {
    required: true,
    content: {
      "application/json": { schema: { $ref: `#/components/schemas/${name}` } },
    },
  };
}

function json<T>(schema: T, example: unknown) {
  return { "application/json": { schema, example } };
}

function param(name: string, description: string) {
  return {
    name,
    in: "path" as const,
    required: true,
    schema: { type: "string" as const },
    description,
  };
}

/** Registers Phase 9 documentation after the Phase 0–8 route modules. */
export function registerPhase9Routes() {
  registry.registerPath({
    method: "get",
    path: REVIEWS_PATH,
    operationId: "listReviews",
    tags: ["Reviews"],
    summary: "List public reviews for one user",
    description: "Cursor-paginated (default 20, max 50). Only safe participant cards are returned.",
    security: [],
    parameters: [
      {
        name: "userId",
        in: "query",
        required: true,
        schema: { type: "string" },
        description: "Profile whose received reviews should be listed",
      },
      ...paginationParameters,
    ],
    responses: {
      200: { description: "Review page", content: json(reviewListSuccessEnvelopeSchema, { data: [REVIEW], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "post",
    path: REVIEWS_PATH,
    operationId: "createReview",
    tags: ["Reviews"],
    summary: "Review the other participant of a completed loan",
    description: "One review per side. The reviewee is derived from the loan; a mismatched id is forbidden.",
    security: sessionSecurity,
    requestBody: body("CreateReviewRequest"),
    responses: {
      201: { description: "Review created", content: json(reviewSuccessEnvelopeSchema, { data: REVIEW }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "get",
    path: REVIEW_PATH,
    operationId: "getReview",
    tags: ["Reviews"],
    summary: "Get one public review",
    security: [],
    parameters: [param("reviewId", "Review identifier")],
    responses: {
      200: { description: "Review detail", content: json(reviewSuccessEnvelopeSchema, { data: REVIEW }) },
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: REPORTS_PATH,
    operationId: "listReports",
    tags: ["Reports"],
    summary: "List reports visible to the session user",
    description: "Reporters see only their own reports; ADMIN sees the full queue with an optional status filter.",
    security: sessionSecurity,
    parameters: [
      {
        name: "status",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["OPEN", "RESOLVED", "DISMISSED"] },
        description: "Optional report status filter",
      },
      ...paginationParameters,
    ],
    responses: {
      200: { description: "Report page", content: json(reportListSuccessEnvelopeSchema, { data: [REPORT], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "post",
    path: REPORTS_PATH,
    operationId: "createReport",
    tags: ["Reports"],
    summary: "Report a user, post, comment or message",
    description: "Creates an OPEN report. Resolution is an ADMIN operation. Duplicate open reports conflict.",
    security: sessionSecurity,
    requestBody: body("CreateReportRequest"),
    responses: {
      201: { description: "Report created", content: json(reportSuccessEnvelopeSchema, { data: REPORT }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "get",
    path: NOTIFICATIONS_PATH,
    operationId: "listNotifications",
    tags: ["Notifications"],
    summary: "List the session user's notifications",
    description: "Cursor-paginated (default 20, max 50); `unread=true` keeps only unread notifications.",
    security: sessionSecurity,
    parameters: [
      {
        name: "unread",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["true", "false"] },
        description: "Filter to unread notifications only",
      },
      ...paginationParameters,
    ],
    responses: {
      200: { description: "Notification page", content: json(notificationListSuccessEnvelopeSchema, { data: [NOTIFICATION], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "get",
    path: NOTIFICATIONS_UNREAD_COUNT_PATH,
    operationId: "getUnreadNotificationCount",
    tags: ["Notifications"],
    summary: "Count unread notifications for the session user",
    security: sessionSecurity,
    responses: {
      200: { description: "Unread count", content: json(unreadNotificationCountSuccessEnvelopeSchema, { data: { unread: 2 } }) },
      401: STANDARD_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "patch",
    path: NOTIFICATION_READ_PATH,
    operationId: "markNotificationRead",
    tags: ["Notifications"],
    summary: "Mark one notification as read",
    description: "Scoped to the session user; repeated calls are idempotent.",
    security: sessionSecurity,
    parameters: [param("notificationId", "Notification identifier")],
    responses: {
      200: { description: "Read result", content: json(notificationMarkReadSuccessEnvelopeSchema, { data: { id: "ntf_123", read: true, readAt: UPDATED_AT } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "patch",
    path: NOTIFICATIONS_READ_ALL_PATH,
    operationId: "markAllNotificationsRead",
    tags: ["Notifications"],
    summary: "Mark all session user notifications as read",
    security: sessionSecurity,
    responses: {
      200: { description: "Bulk read result", content: json(notificationMarkAllReadSuccessEnvelopeSchema, { data: { markedRead: 2 } }) },
      401: STANDARD_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "get",
    path: BLOCKS_PATH,
    operationId: "listBlocks",
    tags: ["Blocks"],
    summary: "List users blocked by the session user",
    description: "Cursor-paginated (default 20, max 50) with a safe public user card.",
    security: sessionSecurity,
    parameters: paginationParameters,
    responses: {
      200: { description: "Block page", content: json(blockListSuccessEnvelopeSchema, { data: [BLOCKED_USER], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "post",
    path: BLOCKS_PATH,
    operationId: "blockUser",
    tags: ["Blocks"],
    summary: "Block another user",
    description: "Removes follows and connections in the same transaction. Conversations are retained but stay unreadable through the existing messaging guard.",
    security: sessionSecurity,
    requestBody: body("BlockUserRequest"),
    responses: {
      201: { description: "User blocked", content: json(blockSuccessEnvelopeSchema, { data: BLOCKED_USER }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
      422: STANDARD_ERROR_RESPONSES[422],
    },
  });

  registry.registerPath({
    method: "delete",
    path: BLOCK_PATH,
    operationId: "unblockUser",
    tags: ["Blocks"],
    summary: "Remove the session user's block",
    security: sessionSecurity,
    parameters: [param("userId", "Blocked user identifier")],
    responses: {
      200: { description: "Unblock result", content: json(unblockSuccessEnvelopeSchema, { data: { userId: "usr_456", blocked: false } }) },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: OWNER_DASHBOARD_PATH,
    operationId: "getOwnerDashboard",
    tags: ["Dashboards"],
    summary: "Get the owner dashboard",
    description: "Active request, received offers, current loan, next due, repayment progress and trust score.",
    security: sessionSecurity,
    responses: {
      200: { description: "Owner dashboard", content: json(ownerDashboardSuccessEnvelopeSchema, { data: OWNER_DASHBOARD }) },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: INVESTOR_DASHBOARD_PATH,
    operationId: "getInvestorDashboard",
    tags: ["Dashboards"],
    summary: "Get the investor dashboard",
    description: "Submitted offers, portfolio totals, repayment progress, earliest due and per-loan health.",
    security: sessionSecurity,
    responses: {
      200: { description: "Investor dashboard", content: json(investorDashboardSuccessEnvelopeSchema, { data: INVESTOR_DASHBOARD }) },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });
}
