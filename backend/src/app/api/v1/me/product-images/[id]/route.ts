import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { handleRequest, ok } from "@/server/http/response";
import { deleteProductImage, updateProductImage } from "@/server/services/profile";
import { idSchema } from "@/server/validators/common";
import { updateProductImageSchema } from "@/server/validators/profile";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireSession();
    const { id: rawId } = await params;
    const imageId = idSchema.parse(rawId);
    const input = updateProductImageSchema.parse(await request.json());
    return ok(await updateProductImage(session.user as Actor, imageId, input));
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireSession();
    const { id: rawId } = await params;
    const imageId = idSchema.parse(rawId);
    return ok(await deleteProductImage(session.user as Actor, imageId));
  });
}
