import "@/server/openapi/setup";
import { z } from "zod";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  loanRequestListSuccessEnvelopeSchema,
  loanRequestSuccessEnvelopeSchema,
  publicLoanRequestListSuccessEnvelopeSchema,
  publicLoanRequestSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const MY_LOAN_REQUESTS_PATH = "/api/v1/me/loan-requests";
export const MY_LOAN_REQUEST_PATH = `${MY_LOAN_REQUESTS_PATH}/{id}`;
export const MY_LOAN_REQUEST_ACTION_PATHS = {
  publish: `${MY_LOAN_REQUEST_PATH}/publish`,
  pause: `${MY_LOAN_REQUEST_PATH}/pause`,
  resume: `${MY_LOAN_REQUEST_PATH}/resume`,
  cancel: `${MY_LOAN_REQUEST_PATH}/cancel`,
} as const;
export const LOAN_REQUESTS_PATH = "/api/v1/loan-requests";
export const LOAN_REQUEST_PATH = `${LOAN_REQUESTS_PATH}/{id}`;

export const LOAN_REQUEST_PATHS = [
  MY_LOAN_REQUESTS_PATH,
  MY_LOAN_REQUEST_PATH,
  ...Object.values(MY_LOAN_REQUEST_ACTION_PATHS),
  LOAN_REQUESTS_PATH,
  LOAN_REQUEST_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];

function jsonSchemaRef(name: string) {
  return {
    "application/json": {
      schema: { $ref: `#/components/schemas/${name}` },
    },
  };
}

function jsonResponse(schema: z.ZodType, example: unknown) {
  return {
    "application/json": { schema, example },
  };
}

const LOAN_REQUEST = {
  id: "lr_123",
  amountBdt: 50_000,
  purpose: "Buy a second oven",
  fundUsage: "Expand weekend meal prep capacity",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
  proposedRatePct: "14.50",
  proofUrls: [],
  status: "DRAFT",
  publishedAt: null,
  createdAt: "2026-11-23T18:00:00.000Z",
  updatedAt: "2026-11-23T18:00:00.000Z",
};

const PUBLIC_LOAN_REQUEST = {
  id: "lr_123",
  amountBdt: 50_000,
  purpose: "Buy a second oven",
  fundUsage: "Expand weekend meal prep capacity",
  tenureDays: 90,
  repaymentFrequency: "WEEKLY",
  proposedRatePct: "14.50",
  publishedAt: "2026-11-23T18:30:00.000Z",
  createdAt: "2026-11-23T18:00:00.000Z",
  owner: {
    name: "Nusrat Akter",
    image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
    shopName: "Nusrat's Home Kitchen",
    slug: "nusrat-home-kitchen",
    category: "Food",
    district: "Dhaka",
    city: "Dhanmondi",
    logoUrl: null,
    trustScore: 80,
    verified: true,
  },
};

const idParam = { $ref: "#/components/parameters/IdPathParam" };
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

const publicFilterParameters = [
  { name: "category", schema: { type: "string" as const } },
  { name: "district", schema: { type: "string" as const } },
  { name: "minAmountBdt", schema: { type: "integer" as const, minimum: 1 } },
  { name: "maxAmountBdt", schema: { type: "integer" as const, minimum: 1 } },
  { name: "maxTenureDays", schema: { type: "integer" as const, minimum: 1 } },
  {
    name: "frequency",
    schema: {
      type: "string" as const,
      enum: ["WEEKLY", "BIWEEKLY", "MONTHLY"],
    },
  },
  {
    name: "sort",
    schema: {
      type: "string" as const,
      enum: ["newest", "amountAsc", "amountDesc"],
      default: "newest",
    },
  },
].map((parameter) => ({
  ...parameter,
  in: "query" as const,
  required: false,
  description: `Filter or sort public loan requests by ${parameter.name}`,
}));

export function registerLoanRequestRoutes() {
  registry.registerPath({
    method: "get",
    path: MY_LOAN_REQUESTS_PATH,
    operationId: "listMyLoanRequests",
    tags: ["Loan requests"],
    summary: "List the authenticated owner's loan requests",
    description:
      "Cursor-paginated (default 20, max 50). Optionally filter by status. Only the owner's own requests are returned, including drafts and closed ones.",
    security: sessionSecurity,
    parameters: [
      {
        name: "status",
        in: "query",
        required: false,
        schema: { $ref: "#/components/schemas/LoanRequestStatus" },
      },
      ...paginationParameters,
    ],
    responses: {
      200: {
        description: "Owner's loan requests",
        content: jsonResponse(loanRequestListSuccessEnvelopeSchema, {
          data: [LOAN_REQUEST],
          meta: { limit: 20, nextCursor: null, hasMore: false },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "post",
    path: MY_LOAN_REQUESTS_PATH,
    operationId: "createLoanRequest",
    tags: ["Loan requests"],
    summary: "Create a DRAFT loan request",
    description:
      "OWNER only. `ownerId`, `status`, `publishedAt` and other server-controlled fields cannot be supplied. Publishing is a separate action after verification and profile checks.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("CreateLoanRequestRequest"),
    },
    responses: {
      201: {
        description: "Draft created",
        content: jsonResponse(loanRequestSuccessEnvelopeSchema, {
          data: LOAN_REQUEST,
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: MY_LOAN_REQUEST_PATH,
    operationId: "getMyLoanRequest",
    tags: ["Loan requests"],
    summary: "Get the owner's own loan request by ID",
    description: "Returns full owner-only fields. Other users' requests return 404.",
    security: sessionSecurity,
    parameters: [idParam],
    responses: {
      200: {
        description: "Owner's loan request",
        content: jsonResponse(loanRequestSuccessEnvelopeSchema, {
          data: LOAN_REQUEST,
        }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "patch",
    path: MY_LOAN_REQUEST_PATH,
    operationId: "updateLoanRequest",
    tags: ["Loan requests"],
    summary: "Edit a DRAFT or PAUSED loan request",
    description:
      "Only DRAFT and PAUSED requests are editable. OPEN, IN_DISCUSSION and closed requests return 409. Ownership is checked against the session user.",
    security: sessionSecurity,
    parameters: [idParam],
    requestBody: {
      required: true,
      content: jsonSchemaRef("UpdateLoanRequestRequest"),
    },
    responses: {
      200: {
        description: "Updated loan request",
        content: jsonResponse(loanRequestSuccessEnvelopeSchema, {
          data: LOAN_REQUEST,
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  const actions = [
    {
      path: MY_LOAN_REQUEST_ACTION_PATHS.publish,
      operationId: "publishLoanRequest",
      summary: "Publish a DRAFT request (DRAFT → OPEN)",
      description:
        "Requires APPROVED OWNER verification, a complete business profile and no other active request. Creates a LOAN_REQUEST feed post in the same transaction.",
      statuses: [401, 403, 404, 409, 422] as const,
    },
    {
      path: MY_LOAN_REQUEST_ACTION_PATHS.pause,
      operationId: "pauseLoanRequest",
      summary: "Pause a request (OPEN | IN_DISCUSSION → PAUSED)",
      description: "Hides the auto-created feed post until the request is resumed.",
      statuses: [401, 403, 404, 409] as const,
    },
    {
      path: MY_LOAN_REQUEST_ACTION_PATHS.resume,
      operationId: "resumeLoanRequest",
      summary: "Resume a request (PAUSED → OPEN)",
      description: "Re-checks verification, profile and the one-active-request rule.",
      statuses: [401, 403, 404, 409, 422] as const,
    },
    {
      path: MY_LOAN_REQUEST_ACTION_PATHS.cancel,
      operationId: "cancelLoanRequest",
      summary: "Cancel a request (DRAFT | OPEN | IN_DISCUSSION | PAUSED → CANCELLED)",
      description: "Terminal action. The request can no longer be edited or resumed.",
      statuses: [401, 403, 404, 409] as const,
    },
  ];

  for (const action of actions) {
    registry.registerPath({
      method: "post",
      path: action.path,
      operationId: action.operationId,
      tags: ["Loan requests"],
      summary: action.summary,
      description: action.description,
      security: sessionSecurity,
      parameters: [idParam],
      responses: {
        200: {
          description: "Updated loan request",
          content: jsonResponse(loanRequestSuccessEnvelopeSchema, {
            data: LOAN_REQUEST,
          }),
        },
        ...Object.fromEntries(
          action.statuses.map((status) => [
            status,
            STANDARD_ERROR_RESPONSES[status],
          ]),
        ),
      },
    });
  }

  registry.registerPath({
    method: "get",
    path: LOAN_REQUESTS_PATH,
    operationId: "listPublicLoanRequests",
    tags: ["Loan requests"],
    summary: "List public OPEN loan requests",
    description:
      "Cursor-paginated (default 20, max 50) with optional category, district, amount, tenure, frequency filters and sorting. Returns only safe public fields; no session required.",
    security: [],
    parameters: [...publicFilterParameters, ...paginationParameters],
    responses: {
      200: {
        description: "Public loan requests",
        content: jsonResponse(publicLoanRequestListSuccessEnvelopeSchema, {
          data: [PUBLIC_LOAN_REQUEST],
          meta: { limit: 20, nextCursor: null, hasMore: false },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
    },
  });

  registry.registerPath({
    method: "get",
    path: LOAN_REQUEST_PATH,
    operationId: "getPublicLoanRequest",
    tags: ["Loan requests"],
    summary: "View a public OPEN loan request",
    description:
      "Returns 404 unless the request is OPEN. No account email/phone, owner id, proof URLs, status history or internal ids are exposed.",
    security: [],
    parameters: [idParam],
    responses: {
      200: {
        description: "Public loan request",
        content: jsonResponse(publicLoanRequestSuccessEnvelopeSchema, {
          data: PUBLIC_LOAN_REQUEST,
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });
}
