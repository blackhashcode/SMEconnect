import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { created, handleRequest } from "@/server/http/response";
import { addProductImage } from "@/server/services/profile";
import { createProductImageSchema } from "@/server/validators/profile";

export async function POST(request: NextRequest) {
  return handleRequest(async () => {
    const session = await requireSession();
    const input = createProductImageSchema.parse(await request.json());
    return created(await addProductImage(session.user as Actor, input));
  });
}
