import "@/server/openapi/setup";
import {
  SECURITY_SCHEME_NAME,
} from "@/server/openapi/config";
import { registry } from "@/server/openapi/registry";
import { AUTH_ERROR_RESPONSES } from "@/server/openapi/schemas";

export const AUTH_BASE_PATH = "/api/v1/auth";

export const SIGN_UP_EMAIL_PATH = `${AUTH_BASE_PATH}/sign-up/email`;
export const SIGN_IN_EMAIL_PATH = `${AUTH_BASE_PATH}/sign-in/email`;
export const SIGN_OUT_PATH = `${AUTH_BASE_PATH}/sign-out`;
export const GET_SESSION_PATH = `${AUTH_BASE_PATH}/get-session`;
export const UPDATE_USER_PATH = `${AUTH_BASE_PATH}/update-user`;
export const SEND_VERIFICATION_OTP_PATH = `${AUTH_BASE_PATH}/email-otp/send-verification-otp`;
export const VERIFY_EMAIL_OTP_PATH = `${AUTH_BASE_PATH}/email-otp/verify-email`;
export const REQUEST_PASSWORD_RESET_OTP_PATH = `${AUTH_BASE_PATH}/email-otp/request-password-reset`;
export const RESET_PASSWORD_OTP_PATH = `${AUTH_BASE_PATH}/email-otp/reset-password`;

export const AUTH_PATHS = [
  SIGN_UP_EMAIL_PATH,
  SIGN_IN_EMAIL_PATH,
  SIGN_OUT_PATH,
  GET_SESSION_PATH,
  UPDATE_USER_PATH,
  SEND_VERIFICATION_OTP_PATH,
  VERIFY_EMAIL_OTP_PATH,
  REQUEST_PASSWORD_RESET_OTP_PATH,
  RESET_PASSWORD_OTP_PATH,
] as const;

const publicSecurity: Array<Record<string, string[]>> = [];
const sessionSecurity: Array<Record<string, string[]>> = [
  { [SECURITY_SCHEME_NAME]: [] },
];

function jsonSchemaRef(name: string) {
  return {
    "application/json": {
      schema: { $ref: `#/components/schemas/${name}` },
    },
  };
}

function okResponse(name: string, description: string) {
  return {
    description,
    content: jsonSchemaRef(name),
  };
}

/** Documents the product-facing Better Auth endpoints actually mounted. */
export function registerAuthRoutes() {
  registry.registerPath({
    method: "post",
    path: SIGN_UP_EMAIL_PATH,
    operationId: "signUpWithEmailAndPassword",
    tags: ["Authentication"],
    summary: "Register an OWNER or INVESTOR account",
    description:
      "Better Auth sign-up. `signupRole` is required and accepts only OWNER or INVESTOR; `role` and `status` are rejected. An OTP verification email is sent to Mailpit.",
    security: publicSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("SignUpEmailRequest"),
    },
    responses: {
      200: okResponse("AuthUserResult", "User created; session is withheld until verification"),
      400: AUTH_ERROR_RESPONSES[400],
      422: AUTH_ERROR_RESPONSES[422],
      429: AUTH_ERROR_RESPONSES[429],
    },
  });

  registry.registerPath({
    method: "post",
    path: SIGN_IN_EMAIL_PATH,
    operationId: "signInWithEmailAndPassword",
    tags: ["Authentication"],
    summary: "Sign in with email and password",
    description:
      "Sets the httpOnly `better-auth.session_token` cookie. Unverified accounts receive an OTP email and cannot sign in yet.",
    security: publicSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("SignInEmailRequest"),
    },
    responses: {
      200: okResponse("AuthUserResult", "Signed in; cookie set"),
      401: AUTH_ERROR_RESPONSES[401],
      403: AUTH_ERROR_RESPONSES[403],
      429: AUTH_ERROR_RESPONSES[429],
    },
  });

  registry.registerPath({
    method: "post",
    path: SIGN_OUT_PATH,
    operationId: "signOut",
    tags: ["Authentication"],
    summary: "Sign out and clear the session cookie",
    security: sessionSecurity,
    responses: {
      200: okResponse("AuthSuccessResponse", "Session cleared"),
      401: AUTH_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "get",
    path: GET_SESSION_PATH,
    operationId: "getSession",
    tags: ["Authentication"],
    summary: "Get the current session",
    description: "Returns `null` when there is no valid session cookie.",
    security: sessionSecurity,
    responses: {
      200: {
        description: "Current session or null",
        content: {
          "application/json": {
            schema: {
              oneOf: [
                { $ref: "#/components/schemas/GetSessionResponse" },
                { type: "null" },
              ],
            },
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: UPDATE_USER_PATH,
    operationId: "updateUser",
    tags: ["Users"],
    summary: "Update the current user's name or image",
    description:
      "Better Auth profile update. `role`, `status`, `signupRole` and `email` are not accepted; role is fixed at signup and changed only by privileged flows.",
    security: sessionSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("UpdateAuthUserRequest"),
    },
    responses: {
      200: okResponse("AuthStatusResponse", "Profile updated"),
      400: AUTH_ERROR_RESPONSES[400],
      401: AUTH_ERROR_RESPONSES[401],
    },
  });

  registry.registerPath({
    method: "post",
    path: SEND_VERIFICATION_OTP_PATH,
    operationId: "sendEmailVerificationOTP",
    tags: ["Authentication"],
    summary: "Send an email verification OTP",
    description:
      "Sends a six-digit OTP by email. `type` accepts the product flows `email-verification` and `forget-password`.",
    security: publicSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("SendVerificationOtpRequest"),
    },
    responses: {
      200: okResponse("AuthSuccessResponse", "OTP email sent or request accepted"),
      400: AUTH_ERROR_RESPONSES[400],
      429: AUTH_ERROR_RESPONSES[429],
    },
  });

  registry.registerPath({
    method: "post",
    path: VERIFY_EMAIL_OTP_PATH,
    operationId: "verifyEmailOTP",
    tags: ["Authentication"],
    summary: "Verify email with OTP",
    description:
      "Marks the email as verified and, because `autoSignInAfterVerification` is enabled, sets a session cookie.",
    security: publicSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("VerifyEmailOtpRequest"),
    },
    responses: {
      200: okResponse("VerifyEmailOtpResponse", "Email verified; session cookie set"),
      400: AUTH_ERROR_RESPONSES[400],
      429: AUTH_ERROR_RESPONSES[429],
    },
  });

  registry.registerPath({
    method: "post",
    path: REQUEST_PASSWORD_RESET_OTP_PATH,
    operationId: "requestPasswordResetWithEmailOTP",
    tags: ["Authentication"],
    summary: "Send a password-reset OTP",
    security: publicSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("RequestPasswordResetOtpRequest"),
    },
    responses: {
      200: okResponse("AuthSuccessResponse", "OTP email sent or request accepted"),
      400: AUTH_ERROR_RESPONSES[400],
      429: AUTH_ERROR_RESPONSES[429],
    },
  });

  registry.registerPath({
    method: "post",
    path: RESET_PASSWORD_OTP_PATH,
    operationId: "resetPasswordWithEmailOTP",
    tags: ["Authentication"],
    summary: "Reset a password with OTP",
    description:
      "Existing sessions are revoked after a successful reset. A successful reset also marks the email as verified.",
    security: publicSecurity,
    requestBody: {
      required: true,
      content: jsonSchemaRef("ResetPasswordOtpRequest"),
    },
    responses: {
      200: okResponse("AuthSuccessResponse", "Password reset"),
      400: AUTH_ERROR_RESPONSES[400],
      429: AUTH_ERROR_RESPONSES[429],
    },
  });
}
