import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import type { Actor } from "@/server/auth/policy";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { handleRequest, ok } from "@/server/http/response";
import { clientIp, recordAudit } from "@/server/services/audit-log";
import { publishRepaymentPost } from "@/server/services/notify";
import { confirmRepayment } from "@/server/services/repayments";
import { idSchema } from "@/server/validators/common";

interface RouteContext {
  params: Promise<{ repaymentId: string }>;
}

const bodySchema = z.object({ reason: z.string().trim().min(5).max(500) }).strict();

/**
 * ADMIN override: confirm an instalment on the investor's behalf (for example
 * the investor is unresponsive but the payment is proven). Marks it paid first if
 * the owner hadn't, then runs the normal confirmation so the loan completes as usual.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  return handleRequest(async () => {
    const session = await requireRole("ADMIN");
    const repaymentId = idSchema.parse((await params).repaymentId);
    const { reason } = bodySchema.parse(await request.json());
    const repayment = await prisma.repayment.findUnique({ where: { id: repaymentId }, select: { id: true, status: true, loan: { select: { investorId: true } } } });
    if (!repayment) throw new NotFoundError("Repayment not found");
    if (repayment.status === "UPCOMING" || repayment.status === "OVERDUE") {
      await prisma.repayment.update({ where: { id: repaymentId }, data: { status: "MARKED_PAID", markedPaidAt: new Date(), note: `Marked paid by admin: ${reason}` } });
    }
    const investor = { id: repayment.loan.investorId, role: "INVESTOR", status: "ACTIVE" } as Actor;
    const result = repayment.status === "CONFIRMED" ? { id: repaymentId, status: "CONFIRMED" } : await confirmRepayment(investor, repaymentId);
    await recordAudit({ actorId: session.user.id, action: "admin.repayment_confirmed", targetType: "REPAYMENT", targetId: repaymentId, detail: { reason, previousStatus: repayment.status }, ipAddress: clientIp(request.headers) });
    await publishRepaymentPost(repaymentId);
    return ok(result);
  });
}
