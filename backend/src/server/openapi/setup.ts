import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/**
 * Zod 4 copies methods from `ZodType.prototype` onto each schema when it is
 * created, so this patch must run before validator modules construct schemas.
 * Importing it from those modules keeps that order explicit in production
 * builds as well as in dev/tests.
 */
extendZodWithOpenApi(z);
