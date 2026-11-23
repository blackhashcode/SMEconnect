import "@/server/openapi/setup";
import { z } from "zod";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  meSuccessEnvelopeSchema,
  productImageDeleteSuccessEnvelopeSchema,
  productImageSuccessEnvelopeSchema,
  publicProfileSuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const ME_PATH = "/api/v1/me";
export const PRODUCT_IMAGES_PATH = `${ME_PATH}/product-images`;
export const PRODUCT_IMAGE_PATH = `${PRODUCT_IMAGES_PATH}/{id}`;
export const PUBLIC_PROFILE_PATH = "/api/v1/profiles/{userId}";

export const PROFILE_PATHS = [
  ME_PATH,
  PRODUCT_IMAGES_PATH,
  PRODUCT_IMAGE_PATH,
  PUBLIC_PROFILE_PATH,
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

const ME_EXAMPLE = {
  data: {
    user: {
      id: "usr_123",
      name: "Nusrat Akter",
      email: "nusrat@example.com",
      emailVerified: true,
      role: "OWNER",
      status: "ACTIVE",
      phone: "+8801712345678",
      phoneVerified: true,
      image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
    },
    profile: {
      shopName: "Nusrat's Home Kitchen",
      slug: "nusrat-home-kitchen",
      category: "Food",
      description: "Home-cooked meals delivered across Dhanmondi.",
      district: "Dhaka",
      city: "Dhanmondi",
      facebookUrl: "https://www.facebook.com/example",
      instagramUrl: null,
      whatsappUrl: null,
      websiteUrl: null,
      runningSince: "2024-01-15T00:00:00.000Z",
      monthlyOrdersRange: "100-200",
      monthlySalesMinBdt: 20_000,
      monthlySalesMaxBdt: 50_000,
      growthStory: null,
      logoUrl: null,
      coverUrl: null,
      trustScore: 80,
      createdAt: "2026-11-23T18:00:00.000Z",
      updatedAt: "2026-11-23T18:00:00.000Z",
      productImages: [],
    },
    verification: { type: "OWNER", status: "APPROVED" },
    unread: { notifications: 2, messages: 0 },
  },
};

export function registerProfileRoutes() {
  registry.registerPath({
    method: "get",
    path: ME_PATH,
    operationId: "getMe",
    tags: ["Users"],
    summary: "Get the current user's account and profile",
    description:
      "Returns the authenticated user's account, role-specific profile (OWNER business or INVESTOR profile), own verification state and unread counts. Admins receive no owner/investor profile.",
    security: sessionSecurity,
    responses: {
      200: {
        description: "Current account and profile",
        content: jsonResponse(meSuccessEnvelopeSchema, ME_EXAMPLE),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "patch",
    path: ME_PATH,
    operationId: "updateMe",
    tags: ["Users"],
    summary: "Update account details and upsert the role-specific profile",
    description:
      "Only the authenticated user's account is updated. An optional `profile` object creates or updates a business profile (OWNER) or investor profile (INVESTOR). User id, role, status, verification status, trust score and profile ownership are server-controlled and cannot be supplied.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("UpdateMeRequest"),
    },
    responses: {
      200: {
        description: "Updated account and profile",
        content: jsonResponse(meSuccessEnvelopeSchema, ME_EXAMPLE),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "post",
    path: PRODUCT_IMAGES_PATH,
    operationId: "addProductImage",
    tags: ["Business profiles"],
    summary: "Add a product image to the owner's business profile",
    description:
      "OWNER only. Accepts an external image URL or an internal public upload URL; private verification files are rejected. Omit `position` to append after the last image.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("CreateProductImageRequest"),
    },
    responses: {
      201: {
        description: "Created product image",
        content: jsonResponse(productImageSuccessEnvelopeSchema, {
          data: {
            id: "img_123",
            url: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
            caption: "Signature dish",
            position: 0,
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      409: STANDARD_ERROR_RESPONSES[409],
    },
  });

  registry.registerPath({
    method: "patch",
    path: PRODUCT_IMAGE_PATH,
    operationId: "updateProductImage",
    tags: ["Business profiles"],
    summary: "Edit the owner's product image",
    description: "OWNER only, and only for images on their own business profile.",
    security: sessionSecurity,
    parameters: [{ $ref: "#/components/parameters/IdPathParam" }],
    requestBody: {
      required: true,
      content: jsonSchemaRef("UpdateProductImageRequest"),
    },
    responses: {
      200: {
        description: "Updated product image",
        content: jsonResponse(productImageSuccessEnvelopeSchema, {
          data: {
            id: "img_123",
            url: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
            caption: "Updated caption",
            position: 0,
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
    method: "delete",
    path: PRODUCT_IMAGE_PATH,
    operationId: "deleteProductImage",
    tags: ["Business profiles"],
    summary: "Delete the owner's product image",
    description: "OWNER only, and only for images on their own business profile.",
    security: sessionSecurity,
    parameters: [{ $ref: "#/components/parameters/IdPathParam" }],
    responses: {
      200: {
        description: "Product image deleted",
        content: jsonResponse(productImageDeleteSuccessEnvelopeSchema, {
          data: { id: "img_123", deleted: true },
        }),
      },
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });

  registry.registerPath({
    method: "get",
    path: PUBLIC_PROFILE_PATH,
    operationId: "getPublicProfile",
    tags: ["Users"],
    summary: "Get a public owner or investor profile",
    description:
      "No session required. Returns only public fields: display name, avatar, role, verified badge and the role-specific public profile. Account email/phone, internal ids, private verification documents and review notes are never returned. Missing, suspended or admin profiles return 404.",
    security: [],
    parameters: [
      {
        name: "userId",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Public user identifier of the profile owner",
      },
    ],
    responses: {
      200: {
        description: "Public profile",
        content: jsonResponse(publicProfileSuccessEnvelopeSchema, {
          data: {
            name: "Nusrat Akter",
            image: "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
            role: "OWNER",
            verified: true,
            profile: {
              shopName: "Nusrat's Home Kitchen",
              slug: "nusrat-home-kitchen",
              category: "Food",
              description: "Home-cooked meals delivered across Dhanmondi.",
              district: "Dhaka",
              city: "Dhanmondi",
              facebookUrl: "https://www.facebook.com/example",
              instagramUrl: null,
              whatsappUrl: null,
              websiteUrl: null,
              runningSince: "2024-01-15T00:00:00.000Z",
              monthlyOrdersRange: "100-200",
              monthlySalesMinBdt: 20_000,
              monthlySalesMaxBdt: 50_000,
              growthStory: null,
              logoUrl: null,
              coverUrl: null,
              trustScore: 80,
              productImages: [],
            },
          },
        }),
      },
      400: STANDARD_ERROR_RESPONSES[400],
      404: STANDARD_ERROR_RESPONSES[404],
    },
  });
}
