import "@/server/openapi/setup";
import { registerHealthRoute } from "@/server/openapi/routes/health";

let registered = false;

/** Registers every implemented endpoint exactly once per process. */
export function registerApiRoutes() {
  if (registered) return;
  registerHealthRoute();
  registered = true;
}
