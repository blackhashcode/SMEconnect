import bcrypt from "bcryptjs";
import { people } from "../../src/data/users.ts";
import { businesses } from "../../src/data/businesses.ts";
import { loanRequests } from "../../src/data/loans.ts";
import { loanOffers } from "../../src/data/offers.ts";
import { chatMessages, chatThreads } from "../../src/data/messages.ts";
import { config } from "./config.ts";
import { get, openDatabase, run, saveNow, transaction } from "./db.ts";

/** Turns mock labels like "2 days ago" or "18 hours ago" into ISO timestamps. */
function isoAgo(label: string, now = Date.now()) {
  const match = label.match(/(\d+)\s*(minute|hour|day|week)s?\s+ago/i);
  const units: Record<string, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 };
  const ms = match ? Number(match[1]) * units[match[2].toLowerCase()] : 0;
  return new Date(now - ms).toISOString();
}

/** The mock inbox is written from Rafiq's side; these offsets place each thread in time. */
const THREAD_AGE_HOURS: Record<string, number> = { "th-1": 1, "th-2": 26, "th-3": 100, "th-4": 150 };
const INBOX_OWNER = "rafiq";

/** Demo accounts sign in as `<id>@demo.smeconnect.bd`, e.g. rafiq@demo.smeconnect.bd. */
export const demoEmail = (id: string) => `${id}@demo.smeconnect.bd`;

/**
 * Loads the front end's mock people and businesses into the database, keeping
 * the same ids so loans, offers and messages in src/data still line up.
 * Safe to run repeatedly: existing rows are left alone.
 */
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
        `INSERT INTO loan_requests (id, business_id, title, amount, purpose, tenure_months, rate, status, description,
           repayment_frequency, image, highlights, progress, connections_count, created_at)
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
      const created = isoAgo(offer.createdAt);
      run(
        `INSERT INTO loan_offers (id, request_id, investor_id, amount, rate, tenure_months, frequency, status, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [offer.id, offer.requestId, offer.investorId, offer.amount, offer.rate, offer.tenureMonths, offer.frequency, offer.status, offer.note, created, created],
      );
      added++;
    }

    // The mock data marks some requests "open" even though they already have live offers.
    run(`UPDATE loan_requests SET status = 'offers_received'
         WHERE status = 'open' AND id IN (SELECT request_id FROM loan_offers WHERE status IN ('pending', 'negotiating'))`);

    // A demo admin for the verification panel. Admins don't appear in the member directory.
    if (!get("SELECT 1 FROM users WHERE id = 'admin'")) {
      run(
        `INSERT INTO users (id, email, password_hash, name, role, headline, location, avatar, cover, about, verified, joined)
         VALUES ('admin', ?, ?, 'SME Connect Admin', 'admin', 'Verification team', 'Dhaka', '', '', 'Reviews identity and trade licence documents.', 1, 'January 2024')`,
        [demoEmail("admin"), passwordHash],
      );
      added++;
    }

    const now = Date.now();
    for (const thread of chatThreads) {
      if (get("SELECT 1 FROM threads WHERE id = ?", [thread.id])) continue;
      const msgs = chatMessages.filter((message) => message.threadId === thread.id);
      const end = now - (THREAD_AGE_HOURS[thread.id] ?? 24) * 3_600_000;
      // Space messages seven minutes apart, ending at the thread's last activity.
      const stamps = msgs.map((_, i) => new Date(end - (msgs.length - 1 - i) * 7 * 60_000).toISOString());
      const first = stamps[0] ?? new Date(end).toISOString();
      const last = stamps[stamps.length - 1] ?? first;
      const loan = thread.businessId ? loanRequests.find((item) => item.businessId === thread.businessId) : undefined;

      run("INSERT INTO threads (id, subject, business_id, loan_request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
        thread.id,
        thread.subject,
        thread.businessId ?? null,
        loan?.id ?? null,
        first,
        last,
      ]);
      // Rafiq has read everything except the thread's unread count; the other side has read it all.
      const readUpTo = thread.unread > 0 ? stamps[stamps.length - 1 - thread.unread] ?? "1970-01-01T00:00:00.000Z" : last;
      run("INSERT INTO thread_participants (thread_id, user_id, last_read_at) VALUES (?, ?, ?)", [thread.id, INBOX_OWNER, readUpTo]);
      run("INSERT INTO thread_participants (thread_id, user_id, last_read_at) VALUES (?, ?, ?)", [thread.id, thread.personId, last]);
      msgs.forEach((message, i) => {
        run("INSERT INTO messages (id, thread_id, sender_id, text, kind, offer_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
          message.id,
          thread.id,
          message.senderId,
          message.text,
          message.kind ?? "text",
          message.offerId ?? null,
          stamps[i],
        ]);
      });
      added++;
    }
  });

  return added;
}

// `npm run seed` runs this file directly.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("src/seed.ts")) {
  await openDatabase();
  const added = await seed();
  saveNow();
  console.log(added ? `Seeded ${added} rows.` : "Database already seeded; nothing to add.");
}
