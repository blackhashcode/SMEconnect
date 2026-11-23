import "@/server/openapi/setup";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/lib/pagination";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  discoveryBusinessListSuccessEnvelopeSchema,
  discoveryInvestorListSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const BUSINESSES_PATH = "/api/v1/businesses";
export const INVESTORS_PATH = "/api/v1/investors";
export const SUGGESTED_BUSINESSES_PATH = "/api/v1/suggestions/businesses";
export const SUGGESTED_INVESTORS_PATH = "/api/v1/suggestions/investors";

export const DISCOVERY_PATHS = [
  BUSINESSES_PATH,
  INVESTORS_PATH,
  SUGGESTED_BUSINESSES_PATH,
  SUGGESTED_INVESTORS_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];
const META_EXAMPLE = { limit: DEFAULT_PAGE_LIMIT, nextCursor: null, hasMore: false };

const BUSINESS = {
  id: "usr_123",
  name: "Nusrat Akter",
  image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
  role: "OWNER",
  verified: true,
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
  district: "Dhaka",
  city: "Dhanmondi",
  logoUrl: null,
  trustScore: 80,
  description: "Home-cooked meals and weekend meal prep",
  loanRequest: {
    id: "lr_123",
    amountBdt: 50_000,
    tenureDays: 90,
    proposedRatePct: "14.50",
  },
};

const INVESTOR = {
  id: "usr_456",
  name: "Rahim Uddin",
  image: null,
  role: "INVESTOR",
  verified: true,
  bio: "Individual investor supporting local food businesses",
  minLendBdt: 10_000,
  maxLendBdt: 100_000,
  preferredCategories: ["Food", "Crafts"],
  district: "Dhaka",
  city: "Dhanmondi",
  trustScore: 75,
};

function paginationParameters() {
  return [
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
}

function queryParam(name: string, schema: Record<string, unknown>, description: string) {
  return { name, in: "query" as const, required: false, schema, description };
}

function json<T>(schema: T, example: unknown) {
  return { "application/json": { schema, example } };
}

export function registerDiscoveryRoutes() {
  registry.registerPath({
    method: "get",
    path: BUSINESSES_PATH,
    operationId: "discoverBusinesses",
    tags: ["Discovery"],
    summary: "Discover approved businesses",
    description:
      "Only active OWNER accounts with an APPROVED verification are returned. Search matches shop name, description and category; `location` matches district OR city. Amount and tenure filters apply to the owner's OPEN loan request. Email, phone, verification documents and internal fields are never exposed. Cursor-paginated (default 20, max 50).",
    parameters: [
      queryParam("q", { type: "string" }, "Case-insensitive search across shop name, description and category"),
      queryParam("category", { type: "string" }, "Business category contains"),
      queryParam("location", { type: "string" }, "District or city contains"),
      queryParam("district", { type: "string" }, "District contains"),
      queryParam("city", { type: "string" }, "City contains"),
      queryParam("minAmountBdt", { type: "integer", minimum: 1 }, "Minimum OPEN loan request amount in whole taka"),
      queryParam("maxAmountBdt", { type: "integer", minimum: 1 }, "Maximum OPEN loan request amount in whole taka"),
      queryParam("maxTenureDays", { type: "integer", minimum: 1 }, "Maximum OPEN loan request tenure in days"),
      queryParam("minTrustScore", { type: "integer", minimum: 0, maximum: 100 }, "Minimum trust score (0-100)"),
      queryParam("sort", { type: "string", enum: ["newest", "trustScore"], default: "newest" }, "Sort order"),
      ...paginationParameters(),
    ],
    responses: {
      200: { description: "Business page", content: json(discoveryBusinessListSuccessEnvelopeSchema, { data: [BUSINESS], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
    },
  });

  registry.registerPath({
    method: "get",
    path: INVESTORS_PATH,
    operationId: "discoverInvestors",
    tags: ["Discovery"],
    summary: "Discover approved investors",
    description:
      "Only active INVESTOR accounts with an APPROVED verification are returned. `category` matches preferredCategories; amounts match the investor's lending range. Private contact and verification data are never exposed. Cursor-paginated (default 20, max 50).",
    parameters: [
      queryParam("q", { type: "string" }, "Case-insensitive search in the investor bio"),
      queryParam("category", { type: "string" }, "Preferred category"),
      queryParam("location", { type: "string" }, "District or city contains"),
      queryParam("district", { type: "string" }, "District contains"),
      queryParam("city", { type: "string" }, "City contains"),
      queryParam("minLendBdt", { type: "integer", minimum: 1 }, "Investor's maximum lending amount must be at least this value"),
      queryParam("maxLendBdt", { type: "integer", minimum: 1 }, "Investor's minimum lending amount must be at most this value"),
      queryParam("minTrustScore", { type: "integer", minimum: 0, maximum: 100 }, "Minimum trust score (0-100)"),
      queryParam("sort", { type: "string", enum: ["newest", "trustScore", "lendAsc", "lendDesc"], default: "newest" }, "Sort order"),
      ...paginationParameters(),
    ],
    responses: {
      200: { description: "Investor page", content: json(discoveryInvestorListSuccessEnvelopeSchema, { data: [INVESTOR], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
    },
  });

  registry.registerPath({
    method: "get",
    path: SUGGESTED_BUSINESSES_PATH,
    operationId: "suggestBusinesses",
    tags: ["Discovery"],
    summary: "Suggested businesses for the authenticated investor",
    description:
      "Matches APPROVED owners against the investor's preferred categories, lending range and location. Only owners with an OPEN loan request are suggested. Derived entirely from the session profile; no client-supplied user id is trusted.",
    security: sessionSecurity,
    parameters: paginationParameters(),
    responses: {
      200: { description: "Business suggestions", content: json(discoveryBusinessListSuccessEnvelopeSchema, { data: [BUSINESS], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });

  registry.registerPath({
    method: "get",
    path: SUGGESTED_INVESTORS_PATH,
    operationId: "suggestInvestors",
    tags: ["Discovery"],
    summary: "Suggested investors for the authenticated owner",
    description:
      "Matches APPROVED investors against the owner's business category, location and OPEN loan request amount. Derived entirely from the session profile.",
    security: sessionSecurity,
    parameters: paginationParameters(),
    responses: {
      200: { description: "Investor suggestions", content: json(discoveryInvestorListSuccessEnvelopeSchema, { data: [INVESTOR], meta: META_EXAMPLE }) },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
    },
  });
}
