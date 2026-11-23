import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateRepaymentSchedule } from "../src/lib/finance";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run prisma/seed.ts");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  console.log("Seeding SME Connect PostgreSQL database...");

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.smeconnect.bd" },
    update: {},
    create: {
      email: "admin@demo.smeconnect.bd",
      name: "Farhana Islam",
      role: "ADMIN",
      emailVerified: true,
      headline: "Verification & Compliance Lead · Dhaka Ops",
      location: "Dhaka",
      trustScore: 100,
    },
  });

  const nusrat = await prisma.user.upsert({
    where: { email: "nusrat@demo.smeconnect.bd" },
    update: {},
    create: {
      email: "nusrat@demo.smeconnect.bd",
      name: "Nusrat Jahan",
      role: "OWNER",
      emailVerified: true,
      headline: "Founder at Nusrat's Home Kitchen",
      location: "Dhanmondi, Dhaka",
      about: "Artisan sourdough and festive bakery serving Dhaka families since 2021.",
      trustScore: 88,
    },
  });

  const rafiq = await prisma.user.upsert({
    where: { email: "rafiq@demo.smeconnect.bd" },
    update: {},
    create: {
      email: "rafiq@demo.smeconnect.bd",
      name: "Rafiq Ahmed",
      role: "INVESTOR",
      emailVerified: true,
      headline: "SME Growth Lender · Food & Retail",
      location: "Gulshan, Dhaka",
      about: "Backing profitable Bangladeshi women-led and artisan SMEs with transparent direct loans.",
      trustScore: 92,
    },
  });

  const business = await prisma.businessProfile.upsert({
    where: { ownerId: nusrat.id },
    update: {},
    create: {
      ownerId: nusrat.id,
      shopName: "Nusrat's Home Kitchen",
      slug: "nusrats-home-kitchen",
      category: "Food & Beverage",
      tagline: "Small-batch artisan bakery & festive gift boxes",
      location: "Dhanmondi, Dhaka",
      founded: "2021",
      teamSize: "6–10 people",
      monthlyRevenueBdt: 285000,
      verified: true,
      trustScore: 88,
      specialties: ["Artisan Cakes", "Corporate Catering", "Eid Gift Boxes"],
    },
  });

  await prisma.investorProfile.upsert({
    where: { userId: rafiq.id },
    update: {},
    create: {
      userId: rafiq.id,
      bio: "Direct growth lender supporting proven local shops.",
      minLendBdt: 25000,
      maxLendBdt: 300000,
      preferredCategories: ["Food & Beverage", "Handicrafts"],
      preferredTenureDays: 180,
      preferredRateMinPct: 10.0,
      preferredRateMaxPct: 16.0,
      location: "Dhaka",
      verified: true,
      trustScore: 92,
    },
  });

  const existingLoan = await prisma.loanRequest.findFirst({ where: { ownerId: nusrat.id } });
  if (!existingLoan) {
    const request = await prisma.loanRequest.create({
      data: {
        ownerId: nusrat.id,
        businessProfileId: business.id,
        title: "Second commercial deck oven for Eid pre-orders",
        amountBdt: 150000,
        purpose: "Equipment & machinery",
        description:
          "Adding a second double-deck oven to double daily production capacity ahead of Ramadan and Eid gift-box orders.",
        tenureDays: 180,
        proposedRatePct: 12.0,
        repaymentFrequency: "MONTHLY",
        highlights: ["3+ years operating", "৳2.85L monthly sales", "Trade licence verified"],
        status: "IN_DISCUSSION",
        publishedAt: new Date(),
      },
    });

    await prisma.offer.create({
      data: {
        loanRequestId: request.id,
        investorId: rafiq.id,
        amountBdt: 150000,
        interestRatePct: 11.5,
        tenureDays: 180,
        repaymentFrequency: "MONTHLY",
        message: "Strong sales history. Happy to finance the full oven cost at 11.5% p.a.",
        status: "PENDING",
        proposedBy: "INVESTOR",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Demonstrate schedule math sanity check during seed
    const sampleSchedule = generateRepaymentSchedule({
      principalBdt: 150000,
      interestRatePct: 11.5,
      tenureDays: 180,
      frequency: "MONTHLY",
    });
    console.log(
      `Seeded admin (${admin.email}), owner (${nusrat.email}), investor (${rafiq.email}). Sample total repayable: ৳${sampleSchedule.totalRepayableBdt}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
