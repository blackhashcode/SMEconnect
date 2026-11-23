import { Router, type Response } from "express";
import { z } from "zod";
import { rateLimit } from "../auth.ts";
import { all, get, pushNotification, recordAudit, run, transaction } from "../db.ts";
import { buildRepaymentSchedule, created, fail, ok } from "../http.ts";
import { ensureThread, postMessage } from "../messaging.ts";
import { cleanText, optionalText } from "../text.ts";
import {
  agreementFor,
  findLoan,
  findOffer,
  loanOwnerId,
  loanViews,
  newId,
  nowIso,
  offerViews,
  repaymentsForLoan,
  toLoanView,
  toOfferView,
  type LoanRow,
  type OfferRow,
  type RepaymentRow,
} from "../views.ts";

export const loansRouter = Router();

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 25,
  key: (req) => `loan-write:${req.user?.id ?? "anon"}`,
});

const bdt = (n: number) => `৳${n.toLocaleString("en-IN")}`;
const frequency = z.enum(["Monthly", "Bi-weekly", "Weekly"]);
const terms = {
  amount: z.number().int("Use a whole number of taka.").min(10_000, "The minimum is ৳10,000.").max(50_000_000, "That's above the ৳5 crore limit."),
  rate: z.number().min(1, "Rate must be at least 1%.").max(30, "Rate can't be above 30%."),
  tenureMonths: z.number().int("Use a whole number of months.").min(3, "Tenure must be at least 3 months.").max(36, "Tenure can't be longer than 36 months."),
};

const overCap = (amount: number, loan: LoanRow) => amount > loan.amount * 2;
const capError = (loan: LoanRow) => ({ amount: [`Offer at most double the ask (${bdt(loan.amount * 2)}).`] });
const LIVE = "('pending', 'negotiating')";

function reopenIfNoLiveOffers(loanId: string) {
  const live = get<{ n: number }>(`SELECT COUNT(*) AS n FROM loan_offers WHERE request_id = ? AND status IN ${LIVE}`, [loanId])?.n ?? 0;
  if (live === 0) run("UPDATE loan_requests SET status = 'open' WHERE id = ? AND status = 'offers_received'", [loanId]);
}

function declineOthers(loan: LoanRow, ownerId: string, reason: string, exceptOfferId?: string) {
  const others = all<OfferRow>(
    `SELECT * FROM loan_offers WHERE request_id = ? AND status IN ${LIVE}${exceptOfferId ? " AND id != ?" : ""}`,
    exceptOfferId ? [loan.id, exceptOfferId] : [loan.id],
  );
  const now = nowIso();
  for (const other of others) {
    run("UPDATE loan_offers SET status = 'declined', last_action_by = 'owner', updated_at = ? WHERE id = ?", [now, other.id]);
    const threadId = ensureThread(ownerId, other.investor_id, {
      subject: `${loan.title} · ${bdt(loan.amount)}`,
      businessId: loan.business_id,
      loanRequestId: loan.id,
    }).id;
    postMessage(threadId, ownerId, `Your offer on “${loan.title}” was declined: ${reason}`, "system", other.id);
    pushNotification({
      userId: other.investor_id,
      kind: "offer",
      personId: ownerId,
      title: "Offer declined",
      body: `Your offer on “${loan.title}” was declined: ${reason}`,
      actionLabel: "View offer",
      href: `/loans/offers/${other.id}/review`,
    });
  }
}

function badRequest(res: Response, error: z.ZodError) {
  fail(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
    fieldErrors: z.flattenError(error).fieldErrors,
  });
}

// ---------- Loan requests ----------

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  businessId: z.string().max(80).optional(),
  status: z.enum(["open", "offers_received", "agreed", "closed", "active"]).optional(),
  mine: z.enum(["1", "true"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

loansRouter.get("/loans", (req, res) => {
  const query = listQuery.parse(req.query);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.businessId) {
    where.push("l.business_id = ?");
    params.push(query.businessId);
  }
  if (query.mine) {
    where.push("b.owner_id = ?");
    params.push(req.user!.id);
  }
  if (query.status === "active") where.push("l.status IN ('open', 'offers_received')");
  else if (query.status) {
    where.push("l.status = ?");
    params.push(query.status);
  }
  if (query.category) {
    where.push("b.category = ? COLLATE NOCASE");
    params.push(query.category);
  }
  if (query.q) {
    where.push("(l.title LIKE ? ESCAPE '\\' OR l.purpose LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\')");
    params.push(like(query.q), like(query.q), like(query.q));
  }
  params.push(query.limit);
  const rows = all<LoanRow>(
    `SELECT l.* FROM loan_requests l JOIN businesses b ON b.id = l.business_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.created_at DESC LIMIT ?`,
    params,
  );
  ok(res, { loans: loanViews(rows) }, { limit: query.limit, count: rows.length });
});

const createLoanSchema = z.object({
  title: cleanText(5, 120, { min: "Give your request a short title (5+ characters)." }),
  purpose: cleanText(2, 60, { min: "Choose a purpose." }),
  description: cleanText(20, 2000, { min: "Tell investors a bit more (20+ characters)." }),
  ...terms,
  repaymentFrequency: frequency,
  highlights: z.array(cleanText(1, 120)).max(5, "Add at most 5 highlights.").optional(),
});

loansRouter.post("/loans", writeLimiter, (req, res) => {
  const user = req.user!;
  if (user.role !== "business" || !user.businessId) {
    fail(res, 403, "FORBIDDEN", "Only business owners can post loan requests.");
    return;
  }
  if (!user.verified) {
    fail(res, 403, "FORBIDDEN", "Your business must be verified before publishing a loan request.");
    return;
  }

  const parsed = createLoanSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const data = parsed.data;

  // Aligned with backend/AGENTS.md §6: max 1 active request per business.
  const active =
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM loan_requests WHERE business_id = ? AND status IN ('open', 'offers_received')",
      [user.businessId],
    )?.n ?? 0;
  if (active >= 1) {
    fail(res, 409, "CONFLICT", "You already have an active loan request. Close or agree it before posting another.");
    return;
  }

  const image = get<{ image: string }>("SELECT image FROM businesses WHERE id = ?", [user.businessId])?.image ?? "";
  const id = newId("lr");
  transaction(() => {
    run(
      `INSERT INTO loan_requests (id, business_id, title, amount, purpose, tenure_months, rate, status, description,
         repayment_frequency, image, highlights, progress, connections_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 0, 0, ?)`,
      [
        id,
        user.businessId!,
        data.title,
        data.amount,
        data.purpose,
        data.tenureMonths,
        data.rate,
        data.description,
        data.repaymentFrequency,
        image,
        JSON.stringify(data.highlights ?? []),
        nowIso(),
      ],
    );
    recordAudit(user.id, "LOAN_REQUEST_CREATED", "LoanRequest", id, { amount: data.amount });
  });
  created(res, { loan: toLoanView(findLoan(id)!) });
});

loansRouter.get("/loans/:id", (req, res) => {
  const loan = findLoan(req.params.id);
  const view = loan ? toLoanView(loan) : null;
  if (!view) {
    fail(res, 404, "NOT_FOUND", "Loan request not found.");
    return;
  }
  ok(res, { loan: view });
});

loansRouter.post("/loans/:id/close", writeLimiter, (req, res) => {
  const loan = findLoan(req.params.id);
  if (!loan) return void fail(res, 404, "NOT_FOUND", "Loan request not found.");
  if (loanOwnerId(loan) !== req.user!.id) return void fail(res, 403, "FORBIDDEN", "Only the business owner can close this request.");
  if (loan.status === "agreed" || loan.status === "closed") return void fail(res, 409, "CONFLICT", "This request is already finished.");
  transaction(() => {
    run("UPDATE loan_requests SET status = 'closed' WHERE id = ?", [loan.id]);
    declineOthers(loan, req.user!.id, "the owner closed this request.");
    recordAudit(req.user!.id, "LOAN_REQUEST_CLOSED", "LoanRequest", loan.id);
  });
  ok(res, { loan: toLoanView(findLoan(loan.id)!) });
});

loansRouter.get("/loans/:id/offers", (req, res) => {
  const loan = findLoan(req.params.id);
  if (!loan) return void fail(res, 404, "NOT_FOUND", "Loan request not found.");
  const isOwner = loanOwnerId(loan) === req.user!.id;
  const rows = isOwner
    ? all<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? ORDER BY created_at DESC", [loan.id])
    : all<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? AND investor_id = ? ORDER BY created_at DESC", [
        loan.id,
        req.user!.id,
      ]);
  ok(res, { offers: offerViews(rows) });
});

loansRouter.get("/loans/:id/agreement", (req, res) => {
  const loan = findLoan(req.params.id);
  const agreement = loan ? agreementFor(loan) : null;
  const viewer = req.user!.id;
  if (!loan || !agreement || (viewer !== agreement.loan.owner.id && viewer !== agreement.offer.investorId)) {
    fail(res, 404, "NOT_FOUND", "No agreement for this request yet.");
    return;
  }
  ok(res, { agreement });
});

// ---------- Repayments ----------

loansRouter.get("/loans/:id/repayments", (req, res) => {
  const loan = findLoan(req.params.id);
  const agreement = loan ? agreementFor(loan) : null;
  const viewer = req.user!.id;
  if (!loan || !agreement || (viewer !== agreement.loan.owner.id && viewer !== agreement.offer.investorId && req.user!.role !== "admin")) {
    fail(res, 404, "NOT_FOUND", "Repayment schedule not found.");
    return;
  }
  ok(res, { repayments: repaymentsForLoan(loan.id) });
});

loansRouter.post("/repayments/:id/mark-paid", writeLimiter, (req, res) => {
  const row = get<RepaymentRow>("SELECT * FROM repayments WHERE id = ?", [req.params.id]);
  if (!row) return void fail(res, 404, "NOT_FOUND", "Installment not found.");
  const loan = findLoan(row.loan_request_id);
  const agreement = loan ? agreementFor(loan) : null;
  if (!loan || !agreement || agreement.loan.owner.id !== req.user!.id) {
    return void fail(res, 403, "FORBIDDEN", "Only the borrower can mark an installment paid.");
  }
  if (row.status !== "UPCOMING" && row.status !== "OVERDUE") {
    return void fail(res, 409, "CONFLICT", `Installment is already ${row.status}.`);
  }
  transaction(() => {
    run("UPDATE repayments SET status = 'MARKED_PAID', marked_paid_at = ? WHERE id = ?", [nowIso(), row.id]);
    pushNotification({
      userId: agreement.offer.investorId,
      kind: "offer",
      personId: req.user!.id,
      title: `Installment #${row.installment_no} marked paid`,
      body: `${agreement.loan.owner.name} marked installment #${row.installment_no} (${bdt(row.amount_bdt)}) paid.`,
      actionLabel: "Confirm receipt",
      href: `/loans/${loan.id}/agreement`,
    });
    recordAudit(req.user!.id, "REPAYMENT_MARKED_PAID", "Repayment", row.id, { loanId: loan.id });
  });
  ok(res, { repayments: repaymentsForLoan(loan.id) });
});

loansRouter.post("/repayments/:id/confirm", writeLimiter, (req, res) => {
  const row = get<RepaymentRow>("SELECT * FROM repayments WHERE id = ?", [req.params.id]);
  if (!row) return void fail(res, 404, "NOT_FOUND", "Installment not found.");
  const loan = findLoan(row.loan_request_id);
  const agreement = loan ? agreementFor(loan) : null;
  if (!loan || !agreement || agreement.offer.investorId !== req.user!.id) {
    return void fail(res, 403, "FORBIDDEN", "Only the investor can confirm repayment receipt.");
  }
  if (row.status !== "MARKED_PAID") {
    return void fail(res, 409, "CONFLICT", "Installment must be marked paid by the borrower first.");
  }
  transaction(() => {
    run("UPDATE repayments SET status = 'CONFIRMED', confirmed_at = ? WHERE id = ?", [nowIso(), row.id]);
    pushNotification({
      userId: agreement.loan.owner.id,
      kind: "offer",
      personId: req.user!.id,
      title: `Installment #${row.installment_no} confirmed`,
      body: `Investor confirmed receipt of installment #${row.installment_no} (${bdt(row.amount_bdt)}).`,
      actionLabel: "View agreement",
      href: `/loans/${loan.id}/agreement`,
    });
    recordAudit(req.user!.id, "REPAYMENT_CONFIRMED", "Repayment", row.id, { loanId: loan.id });
  });
  ok(res, { repayments: repaymentsForLoan(loan.id) });
});

// ---------- Offers ----------

const createOfferSchema = z.object({
  ...terms,
  frequency,
  note: optionalText(1000),
});

loansRouter.post("/loans/:id/offers", writeLimiter, (req, res) => {
  const user = req.user!;
  const loan = findLoan(req.params.id);
  if (!loan) return void fail(res, 404, "NOT_FOUND", "Loan request not found.");
  if (user.role !== "investor") return void fail(res, 403, "FORBIDDEN", "Only investors can make loan offers.");
  if (!user.verified) return void fail(res, 403, "FORBIDDEN", "Your investor account must be verified before making offers.");
  const ownerId = loanOwnerId(loan);
  if (ownerId === user.id) return void fail(res, 403, "FORBIDDEN", "You can't make an offer on your own request.");
  if (loan.status !== "open" && loan.status !== "offers_received") {
    return void fail(res, 409, "CONFLICT", "This request is no longer accepting offers.");
  }
  const existing = get(
    "SELECT 1 FROM loan_offers WHERE request_id = ? AND investor_id = ? AND status IN ('pending', 'negotiating', 'accepted')",
    [loan.id, user.id],
  );
  if (existing) {
    return void fail(res, 409, "CONFLICT", "You already have an active offer on this request. Withdraw it first to send a new one.");
  }

  const parsed = createOfferSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const data = parsed.data;
  if (overCap(data.amount, loan)) {
    return void fail(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", { fieldErrors: capError(loan) });
  }

  const id = newId("of");
  const now = nowIso();
  let threadId = "";
  transaction(() => {
    run(
      `INSERT INTO loan_offers (id, request_id, investor_id, amount, rate, tenure_months, frequency, status, note, last_action_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'investor', ?, ?)`,
      [id, loan.id, user.id, data.amount, data.rate, data.tenureMonths, data.frequency, data.note, now, now],
    );
    if (loan.status === "open") run("UPDATE loan_requests SET status = 'offers_received' WHERE id = ?", [loan.id]);
    threadId = ensureThread(user.id, ownerId!, {
      subject: `${loan.title} · ${bdt(loan.amount)}`,
      businessId: loan.business_id,
      loanRequestId: loan.id,
    }).id;
    postMessage(
      threadId,
      user.id,
      `Sent an offer on “${loan.title}”: ${bdt(data.amount)} at ${data.rate}% p.a. over ${data.tenureMonths} months, repaid ${data.frequency.toLowerCase()}.${data.note ? `\n\n${data.note}` : ""}`,
      "offer",
      id,
    );
    pushNotification({
      userId: ownerId!,
      kind: "offer",
      personId: user.id,
      title: `New loan offer from ${user.name}`,
      body: `${bdt(data.amount)} at ${data.rate}% p.a. for ${data.tenureMonths} months on “${loan.title}”.`,
      actionLabel: "Review offer",
      href: `/loans/offers/${id}/review`,
    });
    recordAudit(user.id, "OFFER_CREATED", "Offer", id, { loanId: loan.id, amount: data.amount });
  });
  created(res, { offer: toOfferView(findOffer(id)!), threadId });
});

const offersQuery = z.object({ role: z.enum(["sent", "received"]).optional() });

loansRouter.get("/offers", (req, res) => {
  const { role } = offersQuery.parse(req.query);
  const me = req.user!.id;
  const sent =
    role !== "received" ? all<OfferRow>("SELECT * FROM loan_offers WHERE investor_id = ? ORDER BY updated_at DESC", [me]) : [];
  const received =
    role !== "sent"
      ? all<OfferRow>(
          `SELECT o.* FROM loan_offers o JOIN loan_requests l ON l.id = o.request_id JOIN businesses b ON b.id = l.business_id
           WHERE b.owner_id = ? ORDER BY o.updated_at DESC`,
          [me],
        )
      : [];
  ok(res, { offers: offerViews([...sent, ...received]) });
});

function offerAccess(offerId: string, userId: string) {
  const offer = findOffer(offerId);
  const loan = offer ? findLoan(offer.request_id) : undefined;
  const ownerId = loan ? loanOwnerId(loan) : undefined;
  if (!offer || !loan || !ownerId) return null;
  const side = userId === ownerId ? "owner" : userId === offer.investor_id ? "investor" : null;
  return side ? { offer, loan, ownerId, side } : null;
}

loansRouter.get("/offers/:id", (req, res) => {
  const access = offerAccess(req.params.id, req.user!.id);
  if (!access) return void fail(res, 404, "NOT_FOUND", "Offer not found.");
  ok(res, { offer: toOfferView(access.offer), loan: toLoanView(access.loan), viewerSide: access.side });
});

const respondSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("accept") }),
    z.object({ action: z.literal("decline"), note: optionalText(500) }),
    z.object({ action: z.literal("withdraw") }),
    z.object({ action: z.literal("counter"), ...terms, note: optionalText(1000) }),
  ],
  { error: "Choose an action: accept, decline, counter or withdraw." },
);

loansRouter.post("/offers/:id/respond", writeLimiter, (req, res) => {
  const me = req.user!.id;
  const access = offerAccess(req.params.id, me);
  if (!access) return void fail(res, 404, "NOT_FOUND", "Offer not found.");
  const { offer, loan, ownerId, side } = access;

  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const input = parsed.data;

  if (offer.status !== "pending" && offer.status !== "negotiating") {
    return void fail(res, 409, "CONFLICT", `This offer is already ${offer.status}.`);
  }
  if (loan.status === "agreed" || loan.status === "closed") {
    return void fail(res, 409, "CONFLICT", "This request is no longer open.");
  }

  const ownersTurn = offer.last_action_by === "investor";
  const allowed =
    side === "owner"
      ? ["decline", "counter", ...(ownersTurn ? ["accept"] : [])]
      : ["withdraw", ...(!ownersTurn && offer.counter_amount !== null ? ["accept"] : [])];
  if (!allowed.includes(input.action)) {
    const reason =
      side === "investor" && input.action === "accept"
        ? "There's no counter-offer from the owner to accept."
        : side === "owner" && input.action === "accept"
          ? "You've sent a counter-offer. Wait for the investor to reply, or revise your counter."
          : `As the ${side === "owner" ? "business owner" : "investor"} you can't ${input.action} this offer.`;
    return void fail(res, 403, "FORBIDDEN", reason);
  }
  if (input.action === "counter" && overCap(input.amount, loan)) {
    return void fail(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", { fieldErrors: capError(loan) });
  }

  const now = nowIso();
  const other = side === "owner" ? offer.investor_id : ownerId;
  let threadId = "";

  transaction(() => {
    threadId = ensureThread(me, other, {
      subject: `${loan.title} · ${bdt(loan.amount)}`,
      businessId: loan.business_id,
      loanRequestId: loan.id,
    }).id;

    switch (input.action) {
      case "accept": {
        if (side === "investor") {
          run("UPDATE loan_offers SET amount = counter_amount, rate = counter_rate, tenure_months = counter_tenure WHERE id = ?", [offer.id]);
        }
        run("UPDATE loan_offers SET status = 'accepted', last_action_by = ?, updated_at = ? WHERE id = ?", [side, now, offer.id]);
        declineOthers(loan, ownerId, "the owner agreed terms with another investor.", offer.id);
        run("UPDATE loan_requests SET status = 'agreed', progress = 100 WHERE id = ?", [loan.id]);
        const final = findOffer(offer.id)!;

        // Generate exact rounding-safe repayment schedule rows atomically.
        run("DELETE FROM repayments WHERE loan_request_id = ?", [loan.id]);
        const schedule = buildRepaymentSchedule(final.amount, final.rate, final.tenure_months, final.frequency);
        for (const inst of schedule.installments) {
          run(
            `INSERT INTO repayments (id, loan_request_id, installment_no, due_date, amount_bdt, status)
             VALUES (?, ?, ?, ?, ?, 'UPCOMING')`,
            [newId("rep"), loan.id, inst.installmentNo, inst.dueDate, inst.amountBdt],
          );
        }

        postMessage(
          threadId,
          me,
          `Accepted the offer on “${loan.title}”: ${bdt(final.amount)} at ${final.rate}% p.a. over ${final.tenure_months} months. The agreement is ready.`,
          "system",
          offer.id,
        );
        pushNotification({
          userId: other,
          kind: "offer",
          personId: me,
          title: "Offer accepted — agreement ready",
          body: `Agreed ${bdt(final.amount)} at ${final.rate}% p.a. on “${loan.title}”.`,
          actionLabel: "View agreement",
          href: `/loans/${loan.id}/agreement`,
        });
        recordAudit(me, "OFFER_ACCEPTED", "Offer", offer.id, { loanId: loan.id, totalRepayableBdt: schedule.totalRepayableBdt });
        break;
      }
      case "decline":
        run("UPDATE loan_offers SET status = 'declined', last_action_by = 'owner', updated_at = ? WHERE id = ?", [now, offer.id]);
        postMessage(threadId, me, `Declined the offer on “${loan.title}”.${input.note ? ` ${input.note}` : ""}`, "system", offer.id);
        reopenIfNoLiveOffers(loan.id);
        pushNotification({
          userId: other,
          kind: "offer",
          personId: me,
          title: "Offer declined",
          body: `Your offer on “${loan.title}” was declined.${input.note ? ` ${input.note}` : ""}`,
          actionLabel: "View offer",
          href: `/loans/offers/${offer.id}/review`,
        });
        recordAudit(me, "OFFER_DECLINED", "Offer", offer.id);
        break;
      case "withdraw":
        run("UPDATE loan_offers SET status = 'withdrawn', last_action_by = 'investor', updated_at = ? WHERE id = ?", [now, offer.id]);
        postMessage(threadId, me, `Withdrew the offer on “${loan.title}”.`, "system", offer.id);
        reopenIfNoLiveOffers(loan.id);
        recordAudit(me, "OFFER_WITHDRAWN", "Offer", offer.id);
        break;
      case "counter":
        run(
          `UPDATE loan_offers SET status = 'negotiating', counter_amount = ?, counter_rate = ?, counter_tenure = ?, counter_note = ?,
             last_action_by = 'owner', updated_at = ? WHERE id = ?`,
          [input.amount, input.rate, input.tenureMonths, input.note, now, offer.id],
        );
        postMessage(
          threadId,
          me,
          `Proposed new terms on “${loan.title}”: ${bdt(input.amount)} at ${input.rate}% p.a. over ${input.tenureMonths} months.${input.note ? `\n\n${input.note}` : ""}`,
          "offer",
          offer.id,
        );
        pushNotification({
          userId: other,
          kind: "offer",
          personId: me,
          title: "Counter-offer proposed",
          body: `Proposed ${bdt(input.amount)} at ${input.rate}% p.a. on “${loan.title}”.`,
          actionLabel: "Review counter",
          href: `/loans/offers/${offer.id}/review`,
        });
        recordAudit(me, "OFFER_COUNTERED", "Offer", offer.id, { amount: input.amount, rate: input.rate });
        break;
    }
  });

  ok(res, { offer: toOfferView(findOffer(offer.id)!), threadId });
});
