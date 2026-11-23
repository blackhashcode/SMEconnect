import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/** Patches Zod once so existing validator schemas can carry OpenAPI metadata. */
extendZodWithOpenApi(z);
