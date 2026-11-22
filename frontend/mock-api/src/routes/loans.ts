import { Router, type Response } from "express";
import { z } from "zod";
import { all, get, run, transaction } from "../db.ts";
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
  toLoanView,
  toOfferView,
  type LoanRow,
  type OfferRow,
} from "../views.ts";

/** Loan requests, offers and agreements. Mounted behind requireAuth. */
export const loansRouter = Router();

const bdt = (n: number) => `৳${n.toLocaleString("en-IN")}`;
const frequency = z.enum(["Monthly", "Bi-weekly", "Weekly"]);
const terms = {
  amount: z.number().int("Use a whole number of taka.").min(10_000, "The minimum is ৳10,000.").max(50_000_000, "That's above the ৳5 crore limit."),
  rate: z.number().min(1, "Rate must be at least 1%.").max(30, "Rate can't be above 30%."),
  tenureMonths: z.number().int("Use a whole number of months.").min(3, "Tenure must be at least 3 months.").max(36, "Tenure can't be longer than 36 months."),
};

/** Offers and counters can't exceed double the amount the business asked for. */
const overCap = (amount: number, loan: LoanRow) => amount > loan.amount * 2;
const capError = (loan: LoanRow) => ({ amount: [`Offer at most double the ask (${bdt(loan.amount * 2)}).`] });

/** Live offers are the ones still in play. */
const LIVE = "('pending', 'negotiating')";

/** A request with offers goes back to "open" once none of them are live any more. */
function reopenIfNoLiveOffers(loanId: string) {
  const live = get<{ n: number }>(`SELECT COUNT(*) AS n FROM loan_offers WHERE request_id = ? AND status IN ${LIVE}`, [loanId])?.n ?? 0;
  if (live === 0) run("UPDATE loan_requests SET status = 'open' WHERE id = ? AND status = 'offers_received'", [loanId]);
}

/** Declines every other live offer on a request and tells each investor in their conversation. */
function declineOthers(loan: LoanRow, ownerId: string, reason: string, exceptOfferId?: string) {
  const others = all<OfferRow>(`SELECT * FROM loan_offers WHERE request_id = ? AND status IN ${LIVE}${exceptOfferId ? " AND id != ?" : ""}`, exceptOfferId ? [loan.id, exceptOfferId] : [loan.id]);
  const now = nowIso();
  for (const other of others) {
    run("UPDATE loan_offers SET status = 'declined', last_action_by = 'owner', updated_at = ? WHERE id = ?", [now, other.id]);
    const threadId = ensureThread(ownerId, other.investor_id, { subject: `${loan.title} · ${bdt(loan.amount)}`, businessId: loan.business_id, loanRequestId: loan.id }).id;
    postMessage(threadId, ownerId, `Your offer on “${loan.title}” was declined: ${reason}`, "system", other.id);
  }
}

function badRequest(res: Response, error: z.ZodError) {
  res.status(400).json({ error: "Please fix the highlighted fields.", fields: z.flattenError(error).fieldErrors });
}

// ---------- Loan requests ----------

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  businessId: z.string().max(80).optional(),
  status: z.enum(["open", "offers_received", "agreed", "closed", "active"]).optional(),
  mine: z.enum(["1", "true"]).optional(),
});

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

loansRouter.get("/loans", (req, res) => {
  const query = listQuery.parse(req.query);
  const where: string[] = [];
  const params: string[] = [];
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
  const rows = all<LoanRow>(
    `SELECT l.* FROM loan_requests l JOIN businesses b ON b.id = l.business_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.created_at DESC`,
    params,
  );
  res.json({ loans: loanViews(rows) });
});

const createLoanSchema = z.object({
  title: cleanText(5, 120, { min: "Give your request a short title (5+ characters)." }),
  purpose: cleanText(2, 60, { min: "Choose a purpose." }),
  description: cleanText(20, 2000, { min: "Tell investors a bit more (20+ characters)." }),
  ...terms,
  repaymentFrequency: frequency,
  highlights: z.array(cleanText(1, 120)).max(5, "Add at most 5 highlights.").optional(),
});

loansRouter.post("/loans", (req, res) => {
  const user = req.user!;
  if (user.role !== "business" || !user.businessId) {
    res.status(403).json({ error: "Only business owners can post loan requests." });
    return;
  }
  const parsed = createLoanSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const data = parsed.data;

  const active = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM loan_requests WHERE business_id = ? AND status IN ('open', 'offers_received')",
    [user.businessId],
  )?.n ?? 0;
  if (active >= 3) {
    res.status(409).json({ error: "You already have 3 open requests. Close or agree one before posting another." });
    return;
  }

  const image = get<{ image: string }>("SELECT image FROM businesses WHERE id = ?", [user.businessId])?.image ?? "";
  const id = newId("lr");
  run(
    `INSERT INTO loan_requests (id, business_id, title, amount, purpose, tenure_months, rate, status, description,
       repayment_frequency, image, highlights, progress, connections_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 0, 0, ?)`,
    [id, user.businessId, data.title, data.amount, data.purpose, data.tenureMonths, data.rate, data.description, data.repaymentFrequency, image, JSON.stringify(data.highlights ?? []), nowIso()],
  );
  res.status(201).json({ loan: toLoanView(findLoan(id)!) });
});

loansRouter.get("/loans/:id", (req, res) => {
  const loan = findLoan(req.params.id);
  const view = loan ? toLoanView(loan) : null;
  if (!view) {
    res.status(404).json({ error: "Loan request not found." });
    return;
  }
  res.json({ loan: view });
});

loansRouter.post("/loans/:id/close", (req, res) => {
  const loan = findLoan(req.params.id);
  if (!loan) return void res.status(404).json({ error: "Loan request not found." });
  if (loanOwnerId(loan) !== req.user!.id) return void res.status(403).json({ error: "Only the business owner can close this request." });
  if (loan.status === "agreed" || loan.status === "closed") return void res.status(409).json({ error: "This request is already finished." });
  transaction(() => {
    run("UPDATE loan_requests SET status = 'closed' WHERE id = ?", [loan.id]);
    declineOthers(loan, req.user!.id, "the owner closed this request.");
  });
  res.json({ loan: toLoanView(findLoan(loan.id)!) });
});

/** The owner sees every offer on their request; anyone else sees only their own. */
loansRouter.get("/loans/:id/offers", (req, res) => {
  const loan = findLoan(req.params.id);
  if (!loan) return void res.status(404).json({ error: "Loan request not found." });
  const isOwner = loanOwnerId(loan) === req.user!.id;
  const rows = isOwner
    ? all<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? ORDER BY created_at DESC", [loan.id])
    : all<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? AND investor_id = ? ORDER BY created_at DESC", [loan.id, req.user!.id]);
  res.json({ offers: offerViews(rows) });
});

/** Visible to the business owner and the investor whose offer it's based on. */
loansRouter.get("/loans/:id/agreement", (req, res) => {
  const loan = findLoan(req.params.id);
  const agreement = loan ? agreementFor(loan) : null;
  const viewer = req.user!.id;
  if (!loan || !agreement || (viewer !== agreement.loan.owner.id && viewer !== agreement.offer.investorId)) {
    res.status(404).json({ error: "No agreement for this request yet." });
    return;
  }
  res.json({ agreement });
});

// ---------- Offers ----------

const createOfferSchema = z.object({
  ...terms,
  frequency,
  note: optionalText(1000),
});

loansRouter.post("/loans/:id/offers", (req, res) => {
  const user = req.user!;
  const loan = findLoan(req.params.id);
  if (!loan) return void res.status(404).json({ error: "Loan request not found." });
  if (user.role !== "investor") return void res.status(403).json({ error: "Only investors can make loan offers." });
  const ownerId = loanOwnerId(loan);
  if (ownerId === user.id) return void res.status(403).json({ error: "You can't make an offer on your own request." });
  if (loan.status !== "open" && loan.status !== "offers_received") {
    return void res.status(409).json({ error: "This request is no longer accepting offers." });
  }
  const existing = get("SELECT 1 FROM loan_offers WHERE request_id = ? AND investor_id = ? AND status IN ('pending', 'negotiating', 'accepted')", [loan.id, user.id]);
  if (existing) return void res.status(409).json({ error: "You already have an active offer on this request. Withdraw it first to send a new one." });

  const parsed = createOfferSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const data = parsed.data;
  if (overCap(data.amount, loan)) {
    return void res.status(400).json({ error: "Please fix the highlighted fields.", fields: capError(loan) });
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
    threadId = ensureThread(user.id, ownerId!, { subject: `${loan.title} · ${bdt(loan.amount)}`, businessId: loan.business_id, loanRequestId: loan.id }).id;
    postMessage(threadId, user.id, `Sent an offer on “${loan.title}”: ${bdt(data.amount)} at ${data.rate}% p.a. over ${data.tenureMonths} months, repaid ${data.frequency.toLowerCase()}.${data.note ? `\n\n${data.note}` : ""}`, "offer", id);
  });
  res.status(201).json({ offer: toOfferView(findOffer(id)!), threadId });
});

const offersQuery = z.object({ role: z.enum(["sent", "received"]).optional() });

/** Offers I've sent (investor) and offers on my requests (business owner). */
loansRouter.get("/offers", (req, res) => {
  const { role } = offersQuery.parse(req.query);
  const me = req.user!.id;
  const sent = role !== "received" ? all<OfferRow>("SELECT * FROM loan_offers WHERE investor_id = ? ORDER BY updated_at DESC", [me]) : [];
  const received =
    role !== "sent"
      ? all<OfferRow>(
          `SELECT o.* FROM loan_offers o JOIN loan_requests l ON l.id = o.request_id JOIN businesses b ON b.id = l.business_id
           WHERE b.owner_id = ? ORDER BY o.updated_at DESC`,
          [me],
        )
      : [];
  res.json({ offers: offerViews([...sent, ...received]) });
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
  if (!access) return void res.status(404).json({ error: "Offer not found." });
  res.json({ offer: toOfferView(access.offer), loan: toLoanView(access.loan), viewerSide: access.side });
});

const respondSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline"), note: optionalText(500) }),
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("counter"), ...terms, note: optionalText(1000) }),
], { error: "Choose an action: accept, decline, counter or withdraw." });

/**
 * Moves an offer through negotiation.
 * - Owner: accept the investor's terms, decline, or counter with new terms.
 * - Investor: accept the owner's counter, or withdraw.
 * Accepting closes the request and declines the other open offers on it.
 */
loansRouter.post("/offers/:id/respond", (req, res) => {
  const me = req.user!.id;
  const access = offerAccess(req.params.id, me);
  if (!access) return void res.status(404).json({ error: "Offer not found." });
  const { offer, loan, ownerId, side } = access;

  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const input = parsed.data;

  if (offer.status !== "pending" && offer.status !== "negotiating") {
    return void res.status(409).json({ error: `This offer is already ${offer.status}.` });
  }
  if (loan.status === "agreed" || loan.status === "closed") {
    return void res.status(409).json({ error: "This request is no longer open." });
  }

  // Whose move is it? After the owner counters, the investor must reply before the
  // owner can accept; the owner can still revise the counter or decline.
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
    return void res.status(403).json({ error: reason });
  }
  if (input.action === "counter" && overCap(input.amount, loan)) {
    return void res.status(400).json({ error: "Please fix the highlighted fields.", fields: capError(loan) });
  }

  const now = nowIso();
  const other = side === "owner" ? offer.investor_id : ownerId;
  const threadId = ensureThread(me, other, { subject: `${loan.title} · ${bdt(loan.amount)}`, businessId: loan.business_id, loanRequestId: loan.id }).id;

  transaction(() => {
    switch (input.action) {
      case "accept": {
        // An investor accepting a counter takes on the owner's proposed terms.
        if (side === "investor") {
          run("UPDATE loan_offers SET amount = counter_amount, rate = counter_rate, tenure_months = counter_tenure WHERE id = ?", [offer.id]);
        }
        run("UPDATE loan_offers SET status = 'accepted', last_action_by = ?, updated_at = ? WHERE id = ?", [side, now, offer.id]);
        declineOthers(loan, ownerId, "the owner agreed terms with another investor.", offer.id);
        run("UPDATE loan_requests SET status = 'agreed', progress = 100 WHERE id = ?", [loan.id]);
        const final = findOffer(offer.id)!;
        postMessage(threadId, me, `Accepted the offer on “${loan.title}”: ${bdt(final.amount)} at ${final.rate}% p.a. over ${final.tenure_months} months. The agreement is ready.`, "system", offer.id);
        break;
      }
      case "decline":
        run("UPDATE loan_offers SET status = 'declined', last_action_by = 'owner', updated_at = ? WHERE id = ?", [now, offer.id]);
        postMessage(threadId, me, `Declined the offer on “${loan.title}”.${input.note ? ` ${input.note}` : ""}`, "system", offer.id);
        reopenIfNoLiveOffers(loan.id);
        break;
      case "withdraw":
        run("UPDATE loan_offers SET status = 'withdrawn', last_action_by = 'investor', updated_at = ? WHERE id = ?", [now, offer.id]);
        postMessage(threadId, me, `Withdrew the offer on “${loan.title}”.`, "system", offer.id);
        reopenIfNoLiveOffers(loan.id);
        break;
      case "counter":
        run(
          `UPDATE loan_offers SET status = 'negotiating', counter_amount = ?, counter_rate = ?, counter_tenure = ?, counter_note = ?,
             last_action_by = 'owner', updated_at = ? WHERE id = ?`,
          [input.amount, input.rate, input.tenureMonths, input.note, now, offer.id],
        );
        postMessage(threadId, me, `Proposed new terms on “${loan.title}”: ${bdt(input.amount)} at ${input.rate}% p.a. over ${input.tenureMonths} months.${input.note ? `\n\n${input.note}` : ""}`, "offer", offer.id);
        break;
    }
  });

  res.json({ offer: toOfferView(findOffer(offer.id)!), threadId });
});
