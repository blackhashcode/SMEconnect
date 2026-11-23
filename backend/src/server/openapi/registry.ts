import "@/server/openapi/setup";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

/** Central registry shared by schemas and route documentation modules. */
export const registry = new OpenAPIRegistry();
