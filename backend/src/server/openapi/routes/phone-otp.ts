import "@/server/openapi/setup";
import { SECURITY_SCHEME_NAME } from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import {
  STANDARD_ERROR_RESPONSES,
  phoneOtpRequestSuccessEnvelopeSchema,
  phoneOtpVerifySuccessEnvelopeSchema,
} from "@/server/openapi/schemas";

export const PHONE_OTP_BASE_PATH = "/api/v1/phone-otp";
export const REQUEST_PHONE_OTP_PATH = `${PHONE_OTP_BASE_PATH}/request`;
export const VERIFY_PHONE_OTP_PATH = `${PHONE_OTP_BASE_PATH}/verify`;
export const PHONE_OTP_PATHS = [
  REQUEST_PHONE_OTP_PATH,
  VERIFY_PHONE_OTP_PATH,
] as const;

const sessionSecurity = [{ [SECURITY_SCHEME_NAME]: [] }];

function jsonSchemaRef(name: string) {
  return {
    "application/json": {
      schema: { $ref: `#/components/schemas/${name}` },
    },
  };
}

export function registerPhoneOtpRoutes() {
  registry.registerPath({
    method: "post",
    path: REQUEST_PHONE_OTP_PATH,
    operationId: "requestPhoneOtp",
    tags: ["Authentication"],
    summary: "Send a phone verification OTP",
    description:
      "Creates a six-digit OTP valid for five minutes. Only hashed OTPs are stored. Local delivery uses the existing email service (Mailpit) or safe console mode.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("RequestPhoneOtpRequest"),
    },
    responses: {
      201: {
        description: "OTP created and delivered",
        content: {
          "application/json": {
            schema: phoneOtpRequestSuccessEnvelopeSchema,
            example: {
              data: {
                phone: "+8801712345678",
                expiresInSeconds: 300,
                sentVia: "email",
              },
            },
          },
        },
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      409: STANDARD_ERROR_RESPONSES[409],
      429: STANDARD_ERROR_RESPONSES[429],
    },
  });

  registry.registerPath({
    method: "post",
    path: VERIFY_PHONE_OTP_PATH,
    operationId: "verifyPhoneOtp",
    tags: ["Authentication"],
    summary: "Verify a phone OTP and link the number",
    description:
      "Verifies the six-digit code, consumes the challenge and updates only the authenticated user's phone fields. Three incorrect attempts invalidate the code.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("VerifyPhoneOtpRequest"),
    },
    responses: {
      200: {
        description: "Phone number verified",
        content: {
          "application/json": {
            schema: phoneOtpVerifySuccessEnvelopeSchema,
            example: {
              data: { phone: "+8801712345678", phoneVerified: true },
            },
          },
        },
      },
      400: STANDARD_ERROR_RESPONSES[400],
      401: STANDARD_ERROR_RESPONSES[401],
      403: STANDARD_ERROR_RESPONSES[403],
      409: STANDARD_ERROR_RESPONSES[409],
      429: STANDARD_ERROR_RESPONSES[429],
    },
  });
}
