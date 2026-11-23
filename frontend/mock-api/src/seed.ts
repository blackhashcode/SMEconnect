import bcrypt from "bcryptjs";
import { people } from "../../src/data/users.ts";
import { businesses } from "../../src/data/businesses.ts";
import { loanRequests } from "../../src/data/loans.ts";
import { loanOffers } from "../../src/data/offers.ts";
import { chatMessages, chatThreads } from "../../src/data/messages.ts";
import { notifications as mockNotifications } from "../../src/data/notifications.ts";
import { verificationCases } from "../../src/data/verification.ts";
import { config } from "./config.ts";
import { get, openDatabase, run, saveNow, transaction } from "./db.ts";
import { buildRepaymentSchedule } from "./http.ts";

function isoAgo(label: string, now = Date.now()) {
  const match = label.match(/(\d+)\s*(minute|hour|day|week)s?\s+ago/i);
  const units: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 };
  const ms = match ? Number(match[1]) * units[match[2].toLowerCase()] : 0;
  return new Date(now - ms).toISOString();
}

const THREAD_AGE_HOURS: Record<string, number> = { "th-1": 1, "th-2": 26, "th-3": 100, "th-4": 150 };
const INBOX_OWNER = "rafiq";

export const demoEmail = (id: string) => `${id}@demo.smeconnect.bd`;

export async function seed() {
  const passwordHash = await bcrypt.hash(config.seedPassword, config.bcryptRounds);
  let added = 0;

  transaction(() => {
    for (const person of people) {
      if (get("SELECT 1 FROM users WHERE id = ?", [person.id])) continue;
      run(
        `INSERT INTO users (id, email, password_hash, name, role, headline, location, avatar, cover, about,
           verified, connections, rating, joined, completed_loans, offers_made, committed, followers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          person.id,
          demoEmail(person.id),
          passwordHash,
          person.name,
          person.role,
          person.headline,
          person.location,
          person.avatar,
          person.cover,
          person.about,
          person.verified ? 1 : 0,
          person.connections,
          person.rating,
          person.joined,
          person.completedLoans ?? null,
          person.offersMade ?? null,
          person.committed ?? null,
          person.followers ?? null,
        ],
      );
      added++;
    }

    for (const business of businesses) {
      if (get("SELECT 1 FROM businesses WHERE id = ?", [business.id])) continue;
      run(
        `INSERT INTO businesses (id, owner_id, name, category, tagline, location, founded, team_size,
           monthly_revenue, image, gallery, description, verified, specialties)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          business.id,
          business.ownerId,
          business.name,
          business.category,
          business.tagline,
          business.location,
          business.founded,
          business.teamSize,
          business.monthlyRevenue,
          business.image,
          JSON.stringify(business.gallery),
          business.description,
          business.verified ? 1 : 0,
          JSON.stringify(business.specialties),
        ],
      );
      added++;
    }

    for (const loan of loanRequests) {
      if (get("SELECT 1 FROM loan_requests WHERE id = ?", [loan.id])) continue;
      run(
        `INSERT INTO loan_requests (id, business_id, title, amount, purpose, tenure_months, rate, status,
           description, repayment_frequency, image, highlights, progress, connections_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          loan.id,
          loan.businessId,
          loan.title,
          loan.amount,
          loan.purpose,
          loan.tenureMonths,
          loan.rate,
          loan.status,
          loan.description,
          loan.repaymentFrequency,
          loan.image,
          JSON.stringify(loan.highlights),
          loan.progress,
          loan.connectionsCount,
          isoAgo(loan.createdAt),
        ],
      );
      added++;
    }

    for (const offer of loanOffers) {
      if (get("SELECT 1 FROM loan_offers WHERE id = ?", [offer.id])) continue;
      const createdAt = isoAgo(offer.createdAt);
      run(
        `INSERT INTO loan_offers (id, request_id, investor_id, amount, rate, tenure_months, frequency, status,
           note, counter_amount, counter_rate, counter_tenure, counter_note, last_action_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          offer.id,
          offer.requestId,
          offer.investorId,
          offer.amount,
          offer.rate,
          offer.tenureMonths,
          offer.frequency,
          offer.status,
          offer.note,
          offer.counter?.amount ?? null,
          offer.counter?.rate ?? null,
          offer.counter?.tenureMonths ?? null,
          offer.counter?.note ?? null,
          offer.lastActionBy ?? (offer.counter ? "owner" : "investor"),
          createdAt,
          createdAt,
        ],
      );
      added++;

      // Generate exact repayment schedule for already-accepted demo loans.
      if (offer.status === "accepted") {
        const hasRepayments = get("SELECT 1 FROM repayments WHERE loan_request_id = ?", [offer.requestId]);
        if (!hasRepayments) {
          const schedule = buildRepaymentSchedule(offer.amount, offer.rate, offer.tenureMonths, offer.frequency);
          for (const inst of schedule.installments) {
            run(
              `INSERT INTO repayments (id, loan_request_id, installment_no, due_date, amount_bdt, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                `rep-${offer.requestId}-${inst.installmentNo}`,
                offer.requestId,
                inst.installmentNo,
                inst.dueDate,
                inst.amountBdt,
                inst.installmentNo === 1 ? "CONFIRMED" : "UPCOMING",
              ],
            );
          }
        }
      }
    }

    const now = Date.now();
    for (const thread of chatThreads) {
      if (get("SELECT 1 FROM threads WHERE id = ?", [thread.id])) continue;
      const updatedAt = new Date(now - (THREAD_AGE_HOURS[thread.id] ?? 12) * 3_600_000).toISOString();
      const firstLoan = thread.businessId
        ? get<{ id: string }>("SELECT id FROM loan_requests WHERE business_id = ? LIMIT 1", [thread.businessId])?.id ?? null
        : null;
      run(
        `INSERT INTO threads (id, subject, business_id, loan_request_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [thread.id, thread.subject, thread.businessId ?? null, firstLoan, updatedAt, updatedAt],
      );
      run("INSERT INTO thread_participants (thread_id, user_id, last_read_at) VALUES (?, ?, ?)", [
        thread.id,
        INBOX_OWNER,
        thread.unread > 0 ? "1970-01-01T00:00:00.000Z" : updatedAt,
      ]);
      run("INSERT INTO thread_participants (thread_id, user_id, last_read_at) VALUES (?, ?, ?)", [
        thread.id,
        thread.personId,
        updatedAt,
      ]);

      const msgs = chatMessages.filter((m) => m.threadId === thread.id);
      msgs.forEach((msg, index) => {
        const msgAt = new Date(new Date(updatedAt).getTime() - (msgs.length - 1 - index) * 180_000).toISOString();
        run(
          `INSERT INTO messages (id, thread_id, sender_id, text, kind, offer_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [msg.id, msg.threadId, msg.senderId, msg.text, msg.kind ?? "text", msg.offerId ?? null, msgAt],
        );
      });
      added++;
    }

    // Seed real notifications for demo users (Rafiq + Nusrat)
    for (const targetUserId of ["rafiq", "nusrat"]) {
      for (const n of mockNotifications) {
        const nid = `${targetUserId}-${n.id}`;
        if (get("SELECT 1 FROM notifications WHERE id = ?", [nid])) continue;
        run(
          `INSERT INTO notifications (id, user_id, kind, person_id, title, body, action_label, href, read_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nid,
            targetUserId,
            n.kind,
            n.personId ?? null,
            n.title,
            n.body,
            n.actionLabel ?? null,
            n.href ?? null,
            n.unread ? null : isoAgo(n.time),
            isoAgo(n.time),
          ],
        );
        added++;
      }
    }

    // Seed real verification queue for admin panel
    for (const item of verificationCases) {
      if (get("SELECT 1 FROM verifications WHERE id = ?", [item.id])) continue;
      if (!get("SELECT 1 FROM users WHERE id = ?", [item.personId])) continue;
      run(
        `INSERT INTO verifications (id, person_id, business_name, type, nid, trade_license, documents, risk, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.personId,
          item.businessName,
          item.type,
          item.nid,
          item.tradeLicense,
          JSON.stringify(item.documents),
          item.risk,
          item.status,
          isoAgo(item.submittedAt),
        ],
      );
      added++;
    }
  });

  return added;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await openDatabase();
  const added = await seed();
  saveNow();
  console.log(added ? `Added ${added} demo rows.` : "Database already has all demo rows.");
}
