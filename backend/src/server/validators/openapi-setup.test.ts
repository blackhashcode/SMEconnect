import { describe, expect, it } from "vitest";
import { idSchema } from "@/server/validators/common";
import {
  roleSchema,
  signupRoleSchema,
  userStatusSchema,
} from "@/server/validators/enums";

type WithOpenApi = { openapi?: unknown };

describe("OpenAPI Zod setup", () => {
  it("patches schemas created directly by validator modules", () => {
    const schemas = [idSchema, roleSchema, signupRoleSchema, userStatusSchema];

    for (const schema of schemas) {
      expect(
        typeof (schema as unknown as WithOpenApi).openapi,
      ).toBe("function");
    }
  });
});
