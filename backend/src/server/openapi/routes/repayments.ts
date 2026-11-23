import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  loanDetailSuccessEnvelopeSchema,
  repaymentListSuccessEnvelopeSchema,
  repaymentSuccessEnvelopeSchema,
  STANDARD_ERROR_RESPONSES,
} from "@/server/openapi/schemas";

export const REPAYMENTS_PATH = "/api/v1/repayments";
export const REPAYMENT_PATH = `${REPAYMENTS_PATH}/{repaymentId}`;
export const REPAYMENT_MARK_PAID_PATH = `${REPAYMENT_PATH}/mark-paid`;
export const REPAYMENT_CONFIRM_PATH = `${REPAYMENT_PATH}/confirm`;
export const LOAN_PATH = "/api/v1/loans/{loanId}";

export const REPAYMENT_PATHS = [
  REPAYMENTS_PATH,
  REPAYMENT_PATH,
  REPAYMENT_MARK_PAID_PATH,
  REPAYMENT_CONFIRM_PATH,
] as const;

export const LOAN_PATHS = [LOAN_PATH] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];

const repaymentIdParam = {
  name: "repaymentId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const },
  description: "Repayment identifier",
};

const loanIdParam = {
  name: "loanId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const },
  description: "Loan identifier",
};

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
  {
    name: "loanId",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const },
    description: "Restrict the page to one participant-owned loan",
  },
];

const CREATED_AT = "2026-11-23T18:00:00.000Z";
const MARKED_AT = "2026-12-07T09:30:00.000Z";
const DUE_AT = "2026-12-14T18:00:00.000Z";

const OWNER = {
  id: "usr_123",
  name: "Nusrat Akter",
  image: null,
  role: "OWNER",
  verified: true,
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
};

const INVESTOR = {
  id: "usr_456",
  name: "Tanvir Ahmed",
  image: null,
  role: "INVESTOR",
  verified: true,
  shopName: null,
  slug: null,
  category: null,
};

const REPAYMENT = {
  id: "rep_1",
  loanId: "loan_123",
  installmentNo: 1,
  dueDate: DUE_AT,
  amountBdt: 3_983,
  status: "MARKED_PAID",
  markedPaidAt: MARKED_AT,
  confirmedAt: null,
  note: "Paid from sales proceeds.",
  proofUrl: null,
  createdAt: CREATED_AT,
  updatedAt: MARKED_AT,
};

const HISTORY = [
  {
    id: "rep_1:scheduled",
    type: "SCHEDULED",
    at: CREATED_AT,
    installmentNo: 1,
    amountBdt: 3_983,
    actorRole: "SYSTEM",
    note: null,
    proofUrl: null,
  },
  {
    id: "rep_1:marked-paid",
    type: "MARKED_PAID",
    at: MARKED_AT,
    installmentNo: 1,
    amountBdt: 3_983,
    actorRole: "OWNER",
    note: "Paid from sales proceeds.",
    proofUrl: null,
  },
];

const LOAN = {
  id: "loan_123",
  loanRequestId: "lr_123",
  offerId: "off_123",
  agreementId: "agr_123",
  status: "ACTIVE",
  principalBdt: 50_000,
  interestRatePct: "14.50",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
  totalRepayableBdt: 51_788,
  startDate: CREATED_AT,
  parties: { owner: OWNER, investor: INVESTOR },
  schedule: [REPAYMENT],
  history: HISTORY,
  progress: {
    totalInstallments: 13,
    upcomingCount: 12,
    overdueCount: 0,
    markedPaidCount: 1,
    confirmedCount: 0,
    confirmedBdt: 0,
    outstandingBdt: 51_788,
  },
  createdAt: CREATED_AT,
  updatedAt: MARKED_AT,
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

function responses(statuses: Array<keyof typeof STANDARD_ERROR_RESPONSES>) {
  return Object.fromEntries(
    statuses.map((status) => [status, STANDARD_ERROR_RESPONSES[status]]),
  );
}

export function registerRepaymentRoutes() {
  registry.registerPath({
    method: "get",
    path: REPAYMENTS_PATH,
    operationId: "listRepayments",
    tags: ["Repayments"],
    summary: "List participant repayments",
    description:
      "Cursor-paginated installments for the session OWNER or INVESTOR. An optional loanId is accepted only when the session user is a participant on that loan. Overdue is derived on read for past-due UPCOMING rows.",
    security: sessionSecurity,
    parameters: paginationParameters,
    responses: {
      200: {
        description: "Repayment page",
        content: json(repaymentListSuccessEnvelopeSchema, {
          data: [REPAYMENT],
          meta: { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false },
        }),
      },
      ...responses([400, 401, 403]),
    },
  });

  registry.registerPath({
    method: "get",
    path: REPAYMENT_PATH,
    operationId: "getRepayment",
    tags: ["Repayments"],
    summary: "Repayment detail",
    description: "Returns one installment only to the owner or investor of its loan.",
    security: sessionSecurity,
    parameters: [repaymentIdParam],
    responses: {
      200: {
        description: "Repayment detail",
        content: json(repaymentSuccessEnvelopeSchema, { data: REPAYMENT }),
      },
      ...responses([400, 401, 403, 404]),
    },
  });

  registry.registerPath({
    method: "post",
    path: REPAYMENT_MARK_PAID_PATH,
    operationId: "markRepaymentPaid",
    tags: ["Repayments"],
    summary: "Mark an installment paid",
    description:
      "Loan owner only. UPCOMING or OVERDUE moves to MARKED_PAID with a server timestamp; an optional sanitized note and private storage proof URL are recorded. Duplicate or concurrent marks return 409.",
    security: sessionSecurity,
    parameters: [repaymentIdParam],
    requestBody: body("MarkRepaymentPaidRequest"),
    responses: {
      200: {
        description: "Marked repayment",
        content: json(repaymentSuccessEnvelopeSchema, { data: REPAYMENT }),
      },
      ...responses([400, 401, 403, 404, 409, 422]),
    },
  });

  registry.registerPath({
    method: "post",
    path: REPAYMENT_CONFIRM_PATH,
    operationId: "confirmRepayment",
    tags: ["Repayments"],
    summary: "Confirm a marked payment",
    description:
      "Loan investor only. MARKED_PAID moves to CONFIRMED. The final confirmation atomically completes the loan and loan request; duplicate or concurrent confirmations return 409.",
    security: sessionSecurity,
    parameters: [repaymentIdParam],
    responses: {
      200: {
        description: "Confirmed repayment",
        content: json(repaymentSuccessEnvelopeSchema, {
          data: { ...REPAYMENT, status: "CONFIRMED", confirmedAt: DUE_AT, note: null },
        }),
      },
      ...responses([400, 401, 403, 404, 409, 422]),
    },
  });

  registry.registerPath({
    method: "get",
    path: LOAN_PATH,
    operationId: "getLoanDetail",
    tags: ["Loans and agreements"],
    summary: "Loan detail with full history",
    description:
      "Loan participants only. Returns server-owned terms, the stored repayment schedule, derived history events and progress totals; no private or verification data is exposed.",
    security: sessionSecurity,
    parameters: [loanIdParam],
    responses: {
      200: {
        description: "Loan detail",
        content: json(loanDetailSuccessEnvelopeSchema, { data: LOAN }),
      },
      ...responses([400, 401, 403, 404]),
    },
  });
}
