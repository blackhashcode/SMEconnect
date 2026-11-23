import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  acceptOfferSuccessEnvelopeSchema,
  agreementSuccessEnvelopeSchema,
  offerListSuccessEnvelopeSchema,
  offerSuccessEnvelopeSchema,
  STANDARD_ERROR_RESPONSES,
} from "@/server/openapi/schemas";

export const OFFERS_PATH = "/api/v1/offers";
export const RECEIVED_OFFERS_PATH = `${OFFERS_PATH}/received`;
export const SUBMITTED_OFFERS_PATH = `${OFFERS_PATH}/submitted`;
export const OFFER_PATH = `${OFFERS_PATH}/{offerId}`;
export const OFFER_WITHDRAW_PATH = `${OFFER_PATH}/withdraw`;
export const OFFER_REJECT_PATH = `${OFFER_PATH}/reject`;
export const OFFER_COUNTER_PATH = `${OFFER_PATH}/counter`;
export const OFFER_ACCEPT_PATH = `${OFFER_PATH}/accept`;
export const AGREEMENTS_PATH = "/api/v1/agreements";
export const AGREEMENT_PATH = `${AGREEMENTS_PATH}/{agreementId}`;
export const AGREEMENT_CONFIRM_PATH = `${AGREEMENT_PATH}/confirm`;

export const OFFER_PATHS = [
  OFFERS_PATH,
  RECEIVED_OFFERS_PATH,
  SUBMITTED_OFFERS_PATH,
  OFFER_PATH,
  OFFER_WITHDRAW_PATH,
  OFFER_REJECT_PATH,
  OFFER_COUNTER_PATH,
  OFFER_ACCEPT_PATH,
] as const;

export const AGREEMENT_PATHS = [AGREEMENT_PATH, AGREEMENT_CONFIRM_PATH] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];
const offerIdParam = {
  name: "offerId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const },
  description: "Offer identifier",
};
const agreementIdParam = {
  name: "agreementId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const },
  description: "Agreement identifier",
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
    name: "loanRequestId",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const },
    description: "Restrict the page to one loan request",
  },
];

const CREATED_AT = "2026-11-23T18:00:00.000Z";
const EXPIRES_AT = "2026-11-30T18:00:00.000Z";

const PARTY = {
  id: "usr_456",
  name: "Tanvir Ahmed",
  image: null,
  role: "INVESTOR",
  verified: true,
  shopName: null,
  slug: null,
  category: null,
};

const OWNER_PARTY = {
  id: "usr_123",
  name: "Nusrat Akter",
  image: null,
  role: "OWNER",
  verified: true,
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
};

const OFFER = {
  id: "off_123",
  loanRequest: {
    id: "lr_123",
    purpose: "Buy a second oven",
    status: "IN_DISCUSSION",
    amountBdt: 50_000,
    tenureDays: 90,
  },
  investor: PARTY,
  owner: OWNER_PARTY,
  amountBdt: 50_000,
  interestRatePct: "14.50",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
  message: "I can fund this oven purchase.",
  status: "PENDING",
  proposedBy: "INVESTOR",
  parentOfferId: null,
  expiresAt: EXPIRES_AT,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const TERMS = {
  loanRequestId: "lr_123",
  offerId: "off_123",
  principalBdt: 50_000,
  interestRatePct: "14.50",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
  totalRepayableBdt: 51_788,
};

const AGREEMENT = {
  id: "agr_123",
  loanId: "loan_123",
  loanRequestId: "lr_123",
  status: "PENDING_AGREEMENT",
  parties: { owner: OWNER_PARTY, investor: PARTY },
  terms: TERMS,
  confirmations: {
    ownerConfirmedAt: null,
    investorConfirmedAt: null,
    bothConfirmed: false,
  },
  schedulePreview: [
    { installmentNo: 1, dueDate: "2026-11-30T18:00:00.000Z", amountBdt: 3_983 },
    { installmentNo: 13, dueDate: "2027-02-22T18:00:00.000Z", amountBdt: 3_992 },
  ],
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

const META_EXAMPLE = { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false };

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

export function registerOfferRoutes() {
  registry.registerPath({
    method: "post",
    path: OFFERS_PATH,
    operationId: "createOffer",
    tags: ["Offers"],
    summary: "Submit an offer",
    description:
      "An APPROVED INVESTOR offers terms on an OPEN or IN_DISCUSSION request they do not own. One live pending offer per investor per request; the first offer moves the request to IN_DISCUSSION. Identity, message sanitization and the 7-day expiry are server-owned.",
    security: sessionSecurity,
    requestBody: body("CreateOfferRequest"),
    responses: {
      201: {
        description: "Created offer",
        content: json(offerSuccessEnvelopeSchema, { data: OFFER }),
      },
      ...responses([400, 401, 403, 404, 409, 422]),
    },
  });

  for (const [path, operationId, summary, description] of [
    [
      RECEIVED_OFFERS_PATH,
      "listReceivedOffers",
      "List received offers",
      "Paginated offers on loan requests owned by the session OWNER.",
    ],
    [
      SUBMITTED_OFFERS_PATH,
      "listSubmittedOffers",
      "List submitted offers",
      "Paginated offers submitted by the session INVESTOR.",
    ],
  ] as const) {
    registry.registerPath({
      method: "get",
      path,
      operationId,
      tags: ["Offers"],
      summary,
      description,
      security: sessionSecurity,
      parameters: paginationParameters,
      responses: {
        200: {
          description: "Offer page",
          content: json(offerListSuccessEnvelopeSchema, {
            data: [OFFER],
            meta: META_EXAMPLE,
          }),
        },
        ...responses([400, 401, 403]),
      },
    });
  }

  registry.registerPath({
    method: "get",
    path: OFFER_PATH,
    operationId: "getOffer",
    tags: ["Offers"],
    summary: "Offer detail",
    description: "Returns an offer only to its investor or the loan-request owner. Pending offers past expiry are reported as EXPIRED.",
    security: sessionSecurity,
    parameters: [offerIdParam],
    responses: {
      200: {
        description: "Offer detail",
        content: json(offerSuccessEnvelopeSchema, { data: OFFER }),
      },
      ...responses([400, 401, 403, 404]),
    },
  });

  for (const [path, operationId, summary, description] of [
    [
      OFFER_WITHDRAW_PATH,
      "withdrawOffer",
      "Withdraw an offer",
      "Only the party who proposed a pending offer may withdraw it.",
    ],
    [
      OFFER_REJECT_PATH,
      "rejectOffer",
      "Reject an offer",
      "Only the other party may reject a pending offer.",
    ],
  ] as const) {
    registry.registerPath({
      method: "post",
      path,
      operationId,
      tags: ["Offers"],
      summary,
      description,
      security: sessionSecurity,
      parameters: [offerIdParam],
      responses: {
        200: {
          description: "Updated offer",
          content: json(offerSuccessEnvelopeSchema, {
            data: { ...OFFER, status: operationId === "withdrawOffer" ? "WITHDRAWN" : "REJECTED" },
          }),
        },
        ...responses([400, 401, 403, 404, 409]),
      },
    });
  }

  registry.registerPath({
    method: "post",
    path: OFFER_COUNTER_PATH,
    operationId: "counterOffer",
    tags: ["Offers"],
    summary: "Counter an offer",
    description:
      "The other party marks the current offer COUNTERED and creates a linked pending offer with a fresh 7-day expiry. Proposer and investor identity are derived from the existing offer and session.",
    security: sessionSecurity,
    parameters: [offerIdParam],
    requestBody: body("CounterOfferRequest"),
    responses: {
      201: {
        description: "Linked counter-offer",
        content: json(offerSuccessEnvelopeSchema, {
          data: { ...OFFER, proposedBy: "OWNER", parentOfferId: "off_123" },
        }),
      },
      ...responses([400, 401, 403, 404, 409, 422]),
    },
  });

  registry.registerPath({
    method: "post",
    path: OFFER_ACCEPT_PATH,
    operationId: "acceptOffer",
    tags: ["Offers"],
    summary: "Accept an offer",
    description:
      "Atomic flow: claim the pending offer, reject sibling offers, create Loan + Agreement, set the request FUNDED and notify both parties. A duplicate or concurrent acceptance returns 409.",
    security: sessionSecurity,
    parameters: [offerIdParam],
    responses: {
      200: {
        description: "Accepted offer and created loan id",
        content: json(acceptOfferSuccessEnvelopeSchema, {
          data: { loanId: "loan_123", offer: { ...OFFER, status: "ACCEPTED" } },
        }),
      },
      ...responses([400, 401, 403, 404, 409, 422]),
    },
  });

  registry.registerPath({
    method: "get",
    path: AGREEMENT_PATH,
    operationId: "getAgreement",
    tags: ["Loans and agreements"],
    summary: "Agreement summary",
    description:
      "Loan participants only. Returns the immutable terms snapshot, both party cards, confirmation timestamps and a server-calculated repayment schedule preview.",
    security: sessionSecurity,
    parameters: [agreementIdParam],
    responses: {
      200: {
        description: "Agreement summary",
        content: json(agreementSuccessEnvelopeSchema, { data: AGREEMENT }),
      },
      ...responses([400, 401, 403, 404]),
    },
  });

  registry.registerPath({
    method: "post",
    path: AGREEMENT_CONFIRM_PATH,
    operationId: "confirmAgreement",
    tags: ["Loans and agreements"],
    summary: "Confirm an agreement",
    description:
      "Each party confirms once. The second confirmation activates the loan, writes the whole-taka repayment schedule, transitions the request to REPAYING, notifies both parties and adds an owner feed post.",
    security: sessionSecurity,
    parameters: [agreementIdParam],
    responses: {
      200: {
        description: "Updated agreement summary",
        content: json(agreementSuccessEnvelopeSchema, {
          data: {
            ...AGREEMENT,
            status: "ACTIVE",
            confirmations: {
              ownerConfirmedAt: CREATED_AT,
              investorConfirmedAt: CREATED_AT,
              bothConfirmed: true,
            },
          },
        }),
      },
      ...responses([400, 401, 403, 404, 409, 422]),
    },
  });
}
