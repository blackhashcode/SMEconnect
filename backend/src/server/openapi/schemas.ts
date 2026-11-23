import "@/server/openapi/setup";
import { z } from "zod";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import * as validators from "@/server/validators";
import { BETTER_AUTH_SESSION_COOKIE, SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";

/** Wraps a data schema in the project's standard success envelope. */
export function successEnvelope<T extends z.ZodType>(data: T) {
  return z
    .object({
      data,
      meta: z.record(z.string(), z.unknown()).optional(),
    })
    .strict();
}

export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string().openapi({
          description: "Stable machine-readable error code",
          example: "VALIDATION_ERROR",
        }),
        message: z.string().openapi({
          description: "Human-readable, non-sensitive error message",
          example: "Invalid input",
        }),
        details: z.unknown().optional().openapi({
          description: "Optional field errors or business-rule details",
        }),
      })
      .strict(),
  })
  .strict();

export const healthSuccessEnvelopeSchema = successEnvelope(
  validators.healthStatusSchema,
);

const cursorSchema = z.string().min(1).openapi({
  param: {
    name: "cursor",
    in: "query",
    description: "Opaque cursor returned by the previous page",
  },
  example: "eyJpZCI6ImV4YW1wbGUifQ",
});

const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_LIMIT)
  .default(DEFAULT_PAGE_LIMIT)
  .openapi({
    param: {
      name: "limit",
      in: "query",
      description: `Page size (default ${DEFAULT_PAGE_LIMIT}, max ${MAX_PAGE_LIMIT})`,
    },
    example: DEFAULT_PAGE_LIMIT,
  });

export const paginationQuerySchema = z
  .object({
    cursor: cursorSchema.optional(),
    limit: limitSchema,
  })
  .strict();

export const paginationMetaSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).openapi({
      example: DEFAULT_PAGE_LIMIT,
    }),
    nextCursor: z.string().nullable().optional().openapi({
      description: "Cursor to pass to the next request; null when no more pages",
    }),
    hasMore: z.boolean().openapi({ example: false }),
  })
  .strict();

export const idPathParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .openapi({
    param: {
      name: "id",
      in: "path",
      description: "Resource identifier",
    },
    example: "usr_123",
  });

function errorResponse(description: string, code: string, message: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
        example: { error: { code, message } },
      },
    },
  };
}

const componentSchemas: ReadonlyArray<readonly [string, z.ZodType]> = [
  // Common primitives
  ["Id", validators.idSchema],
  ["Email", validators.emailSchema],
  ["Url", validators.urlSchema],
  ["IsoDateTime", validators.isoDateTimeSchema],
  ["PlainDate", validators.plainDateSchema],
  ["ShortText", validators.shortTextSchema],
  ["LongText", validators.longTextSchema],
  ["OptionalText", validators.optionalTextSchema],
  ["BdtAmount", validators.bdtAmountSchema],
  ["PositiveBdtAmount", validators.positiveBdtSchema],
  ["Rating", validators.ratingSchema],
  ["TenureDays", validators.tenureDaysSchema],
  ["RatePct", validators.ratePctSchema],

  // Domain enumerations
  ["Role", validators.roleSchema],
  ["SignupRole", validators.signupRoleSchema],
  ["UserStatus", validators.userStatusSchema],
  ["VerificationType", validators.verificationTypeSchema],
  ["VerificationStatus", validators.verificationStatusSchema],
  ["RepaymentFrequency", validators.repaymentFrequencySchema],
  ["LoanRequestStatus", validators.loanRequestStatusSchema],
  ["OfferStatus", validators.offerStatusSchema],
  ["OfferProposer", validators.offerProposerSchema],
  ["LoanStatus", validators.loanStatusSchema],
  ["RepaymentStatus", validators.repaymentStatusSchema],
  ["PostType", validators.postTypeSchema],
  ["ConnectionStatus", validators.connectionStatusSchema],
  ["NotificationType", validators.notificationTypeSchema],
  ["ReportTargetType", validators.reportTargetTypeSchema],
  ["ReportStatus", validators.reportStatusSchema],

  // User and verification requests
  ["UpdateUserRequest", validators.updateUserSchema],
  ["AdminUpdateUserRequest", validators.adminUpdateUserSchema],
  ["UserIdRequest", validators.userIdSchema],
  ["UserNoteRequest", validators.userNoteSchema],
  ["SubmitVerificationRequest", validators.submitVerificationSchema],
  ["ReviewVerificationRequest", validators.reviewVerificationSchema],
  ["VerificationQuery", validators.verificationQuerySchema],

  // Profile requests
  ["CreateBusinessProfileRequest", validators.createBusinessProfileSchema],
  ["UpdateBusinessProfileRequest", validators.updateBusinessProfileSchema],
  ["CreateProductImageRequest", validators.createProductImageSchema],
  ["CreateInvestorProfileRequest", validators.createInvestorProfileSchema],
  ["UpdateInvestorProfileRequest", validators.updateInvestorProfileSchema],

  // Loan and offer requests
  ["CreateLoanRequestRequest", validators.createLoanRequestSchema],
  ["UpdateLoanRequestRequest", validators.updateLoanRequestSchema],
  ["LoanRequestActionRequest", validators.loanRequestActionSchema],
  ["CreateOfferRequest", validators.createOfferSchema],
  ["CounterOfferRequest", validators.counterOfferSchema],
  ["OfferActionRequest", validators.offerActionSchema],
  ["MarkRepaymentPaidRequest", validators.markRepaymentPaidSchema],
  ["ConfirmRepaymentRequest", validators.confirmRepaymentSchema],

  // Feed, networking, reputation and messaging requests
  ["CreatePostRequest", validators.createPostSchema],
  ["UpdatePostRequest", validators.updatePostSchema],
  ["CreateCommentRequest", validators.createCommentSchema],
  ["FollowUserRequest", validators.followUserSchema],
  ["SendConnectionRequestRequest", validators.sendConnectionRequestSchema],
  ["ConnectionActionRequest", validators.connectionActionSchema],
  ["CreateReviewRequest", validators.createReviewSchema],
  ["CreateReportRequest", validators.createReportSchema],
  ["CreateConversationRequest", validators.createConversationSchema],
  ["SendMessageRequest", validators.sendMessageSchema],
  ["MessageActionRequest", validators.messageActionSchema],

  // Shared responses
  ["ErrorEnvelope", errorEnvelopeSchema],
  ["HealthStatus", validators.healthStatusSchema],
  ["HealthSuccessEnvelope", healthSuccessEnvelopeSchema],
  ["PaginationMeta", paginationMetaSchema],
  ["PaginationQuery", paginationQuerySchema],
];

for (const [name, schema] of componentSchemas) {
  registry.register(name, schema);
}

registry.registerParameter("IdPathParam", idPathParamSchema);

registry.registerComponent("securitySchemes", SECURITY_SCHEME_NAME, {
  type: "apiKey" as const,
  in: "cookie" as const,
  name: BETTER_AUTH_SESSION_COOKIE,
  description:
    "Better Auth session cookie. Set by sign-in and sent automatically by the browser on same-origin requests. HttpOnly; Secure in production.",
});

registry.registerComponent(
  "responses",
  "ValidationErrorResponse",
  errorResponse("Input validation failed", "VALIDATION_ERROR", "Invalid input"),
);
registry.registerComponent(
  "responses",
  "UnauthorizedResponse",
  errorResponse("Authentication required", "UNAUTHORIZED", "Authentication required"),
);
registry.registerComponent(
  "responses",
  "ForbiddenResponse",
  errorResponse(
    "Permission denied",
    "FORBIDDEN",
    "You do not have permission to perform this action",
  ),
);
registry.registerComponent(
  "responses",
  "NotFoundResponse",
  errorResponse("Resource not found", "NOT_FOUND", "Resource not found"),
);
registry.registerComponent(
  "responses",
  "ConflictResponse",
  errorResponse(
    "Invalid state transition or conflict",
    "CONFLICT",
    "The resource is in a conflicting state",
  ),
);
registry.registerComponent(
  "responses",
  "BusinessRuleResponse",
  errorResponse(
    "Business rule violation",
    "BUSINESS_RULE_VIOLATION",
    "Business rule violation",
  ),
);
registry.registerComponent(
  "responses",
  "InternalErrorResponse",
  errorResponse("Unexpected server error", "INTERNAL_ERROR", "Something went wrong"),
);
registry.registerComponent(
  "responses",
  "DatabaseUnavailableResponse",
  errorResponse(
    "Database connection failed",
    "DATABASE_UNAVAILABLE",
    "Database connection failed",
  ),
);

/** Reusable references for future operations. Health uses only 503 today. */
export const STANDARD_ERROR_RESPONSES = {
  400: { $ref: "#/components/responses/ValidationErrorResponse" },
  401: { $ref: "#/components/responses/UnauthorizedResponse" },
  403: { $ref: "#/components/responses/ForbiddenResponse" },
  404: { $ref: "#/components/responses/NotFoundResponse" },
  409: { $ref: "#/components/responses/ConflictResponse" },
  422: { $ref: "#/components/responses/BusinessRuleResponse" },
  500: { $ref: "#/components/responses/InternalErrorResponse" },
  503: { $ref: "#/components/responses/DatabaseUnavailableResponse" },
} as const;
