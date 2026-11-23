import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { buildRepaymentSchedule } from "@/server/services/repayment-schedule";

/**
 * Deterministic demo dataset for `prisma db seed`.
 *
 * All identifiers, dates and relationships are derived from a single anchor so
 * running the seed repeatedly with the same configuration yields the same rows.
 * The dataset is fictional except for the one explicitly designated personal
 * owner account; no email is sent by the seed.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEMO_PASSWORD_DEFAULT = "Password123!";
export const ADMIN_EMAIL_DEFAULT = "admin@smeconnect.local";
export const PERSONAL_EMAIL_DEFAULT = "fahimbinimam@gmail.com";
export const ANCHOR_DATE_DEFAULT = "2026-11-23T00:00:00.000Z";

export interface SeedConfig {
  /** Fixed point from which all relative demo dates are derived. */
  anchor: Date;
  /** Plain password used only by the seed writer, never stored directly. */
  demoPassword: string;
  /** True when the standard documented demo password is in use. */
  usesDefaultPassword: boolean;
  /** Deterministic marker for pure dataset tests; replaced by a real hash in seed.ts. */
  passwordHash: string;
  adminEmail: string;
  personalEmail: string;
}

export function seedConfigFromEnv(env: NodeJS.ProcessEnv): SeedConfig {
  const adminEmail = (env.SEED_ADMIN_EMAIL?.trim() || ADMIN_EMAIL_DEFAULT).toLowerCase();
  const personalEmail = (
    env.SEED_PERSONAL_EMAIL?.trim() ||
    PERSONAL_EMAIL_DEFAULT
  ).toLowerCase();
  const usesDefaultPassword = !env.SEED_DEMO_PASSWORD;
  const demoPassword = env.SEED_DEMO_PASSWORD || DEMO_PASSWORD_DEFAULT;
  const anchorValue = env.SEED_ANCHOR_DATE?.trim() || ANCHOR_DATE_DEFAULT;
  const anchor = new Date(anchorValue);

  if (Number.isNaN(anchor.getTime())) {
    throw new Error("SEED_ANCHOR_DATE must be a valid ISO 8601 timestamp");
  }
  if (demoPassword.length < 8 || demoPassword.length > 128) {
    throw new Error("SEED_DEMO_PASSWORD must be between 8 and 128 characters");
  }
  if (adminEmail === personalEmail) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_PERSONAL_EMAIL must be different");
  }

  return {
    anchor,
    demoPassword,
    usesDefaultPassword,
    // Replaced by the real hash in seed.ts; kept as a marker for pure-data tests.
    passwordHash: `HASHED:${demoPassword.length}`,
    adminEmail,
    personalEmail,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** Derives a stable UUID-shaped identifier from any-length demo key. */
function uuid(tail: string): string {
  const digest = createHash("sha256").update(tail).digest("hex").slice(0, 12);
  return `00000000-0000-4000-8000-${digest}`;
}

function publicImage(tail: string, extension: "jpg" | "png" | "webp" = "jpg"): string {
  return `/api/v1/files/public/${uuid(tail)}.${extension}`;
}

function privateDocument(tail: string, extension: "jpg" | "png" | "pdf" = "pdf"): string {
  return `/api/v1/files/private/${uuid(tail)}.${extension}`;
}

type Role = "OWNER" | "INVESTOR" | "ADMIN";
type UserStatus = "ACTIVE" | "SUSPENDED";
type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
type VerificationType = "OWNER" | "INVESTOR";
type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
type LoanRequestStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_DISCUSSION"
  | "FUNDED"
  | "REPAYING"
  | "COMPLETED"
  | "PAUSED"
  | "CANCELLED";
type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTERED" | "WITHDRAWN" | "EXPIRED";
type OfferProposer = "OWNER" | "INVESTOR";
type LoanStatus = "PENDING_AGREEMENT" | "ACTIVE" | "COMPLETED";
type RepaymentStatus = "UPCOMING" | "MARKED_PAID" | "CONFIRMED" | "OVERDUE";
type PostType = "UPDATE" | "MILESTONE" | "LOAN_REQUEST" | "REPAYMENT";
type ConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED";
type NotificationType =
  | "OFFER_RECEIVED"
  | "OFFER_COUNTERED"
  | "OFFER_ACCEPTED"
  | "AGREEMENT_CONFIRMED"
  | "MESSAGE_RECEIVED"
  | "CONNECTION_REQUEST"
  | "CONNECTION_ACCEPTED"
  | "VERIFICATION_RESULT"
  | "REPAYMENT_DUE"
  | "REPAYMENT_OVERDUE"
  | "REPAYMENT_MARKED_PAID"
  | "REPAYMENT_CONFIRMED"
  | "NEW_COMMENT"
  | "NEW_LIKE";
type ReportTargetType = "USER" | "POST" | "COMMENT" | "MESSAGE";
type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string;
  phoneVerified: boolean;
  role: Role;
  status: UserStatus;
}

interface AccountRow {
  id: string;
  accountId: string;
  providerId: string;
  password: string;
  userId: string;
}

interface UserVerificationRow {
  id: string;
  userId: string;
  type: VerificationType;
  status: VerificationStatus;
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
  reviewerId: string | null;
  reviewNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}

interface BusinessProfileRow {
  id: string;
  ownerId: string;
  shopName: string;
  slug: string;
  category: string;
  description: string;
  district: string;
  city: string;
  facebookUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  websiteUrl: string | null;
  runningSince: Date;
  monthlyOrdersRange: string;
  monthlySalesMinBdt: number;
  monthlySalesMaxBdt: number;
  growthStory: string;
  logoUrl: string;
  coverUrl: string;
  trustScore: number;
}

interface ProductImageRow {
  id: string;
  businessProfileId: string;
  url: string;
  caption: string;
  position: number;
}

interface InvestorProfileRow {
  id: string;
  userId: string;
  bio: string;
  minLendBdt: number;
  maxLendBdt: number;
  preferredCategories: string[];
  preferredTenureDays: number;
  preferredRatePctMin: string;
  preferredRatePctMax: string;
  district: string;
  city: string;
  trustScore: number;
}

interface LoanRequestRow {
  id: string;
  ownerId: string;
  amountBdt: number;
  purpose: string;
  fundUsage: string;
  tenureDays: number;
  repaymentFrequency: Frequency;
  proposedRatePct: string;
  proofUrls: string[];
  status: LoanRequestStatus;
  publishedAt: Date | null;
}

interface OfferRow {
  id: string;
  loanRequestId: string;
  investorId: string;
  amountBdt: number;
  interestRatePct: string;
  tenureDays: number;
  repaymentFrequency: Frequency;
  message: string | null;
  status: OfferStatus;
  parentOfferId: string | null;
  proposedBy: OfferProposer;
  expiresAt: Date;
  createdAt: Date;
}

interface LoanRow {
  id: string;
  loanRequestId: string;
  offerId: string;
  ownerId: string;
  investorId: string;
  principalBdt: number;
  interestRatePct: string;
  tenureDays: number;
  repaymentFrequency: Frequency;
  totalRepayableBdt: number;
  status: LoanStatus;
  startDate: Date | null;
}

interface AgreementRow {
  id: string;
  loanId: string;
  termsSnapshot: Prisma.InputJsonValue;
  ownerConfirmedAt: Date | null;
  investorConfirmedAt: Date | null;
}

interface RepaymentRow {
  id: string;
  loanId: string;
  installmentNo: number;
  dueDate: Date;
  amountBdt: number;
  status: RepaymentStatus;
  markedPaidAt: Date | null;
  confirmedAt: Date | null;
  note: string | null;
  proofUrl: string | null;
}

interface PostRow {
  id: string;
  authorId: string;
  type: PostType;
  content: string;
  imageUrls: string[];
  loanRequestId: string | null;
  deletedAt: Date | null;
}

interface CommentRow {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  deletedAt: Date | null;
}

interface LikeRow {
  id: string;
  postId: string;
  userId: string;
}

interface FollowRow {
  id: string;
  followerId: string;
  followeeId: string;
}

interface ConnectionRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  message: string | null;
}

interface ConversationRow {
  id: string;
  participantOneId: string;
  participantTwoId: string;
}

interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: Date | null;
  deletedAt: Date | null;
}

interface MessageDeletionRow {
  id: string;
  messageId: string;
  userId: string;
}

interface NotificationRow {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  data: Prisma.InputJsonValue;
  readAt: Date | null;
}

interface ReviewRow {
  id: string;
  loanId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
}

interface ReportRow {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolutionNote: string | null;
  handledById: string | null;
}

interface BlockRow {
  id: string;
  blockerId: string;
  blockedId: string;
}

export interface DemoDataset {
  users: UserRow[];
  accounts: AccountRow[];
  verifications: UserVerificationRow[];
  businessProfiles: BusinessProfileRow[];
  productImages: ProductImageRow[];
  investorProfiles: InvestorProfileRow[];
  loanRequests: LoanRequestRow[];
  offers: OfferRow[];
  loans: LoanRow[];
  agreements: AgreementRow[];
  repayments: RepaymentRow[];
  posts: PostRow[];
  comments: CommentRow[];
  likes: LikeRow[];
  follows: FollowRow[];
  connections: ConnectionRow[];
  conversations: ConversationRow[];
  messages: MessageRow[];
  messageDeletions: MessageDeletionRow[];
  notifications: NotificationRow[];
  reviews: ReviewRow[];
  reports: ReportRow[];
  blocks: BlockRow[];
}

const OWNER_SPECS = [
  {
    id: "usr_owner_01",
    name: "Md. Fahim Bin Imam Nahid",
    emailKey: "personal" as const,
    phone: "+8801710000001",
    shopName: "Fahim's Home Kitchen",
    slug: "fahims-home-kitchen",
    category: "Food",
    district: "Dhanmondi",
    city: "Dhaka",
    since: 2022,
    orders: "120–180 orders/month",
    sales: [45000, 85000] as const,
  },
  {
    id: "usr_owner_02",
    name: "Nusrat Begum",
    email: "owner02@smeconnect.local",
    phone: "+8801710000002",
    shopName: "Nusrat's Home Kitchen",
    slug: "nusrats-home-kitchen",
    category: "Food",
    district: "Dhanmondi",
    city: "Dhaka",
    since: 2021,
    orders: "90–140 orders/month",
    sales: [35000, 70000] as const,
  },
  {
    id: "usr_owner_03",
    name: "Shamima Akter",
    email: "owner03@smeconnect.local",
    phone: "+8801710000003",
    shopName: "Deshi Threads",
    slug: "deshi-threads",
    category: "Fashion",
    district: "Chattogram",
    city: "Chattogram",
    since: 2020,
    orders: "200–260 orders/month",
    sales: [80000, 140000] as const,
  },
  {
    id: "usr_owner_04",
    name: "Rehana Parvin",
    email: "owner04@smeconnect.local",
    phone: "+8801710000004",
    shopName: "Mati Crafts",
    slug: "mati-crafts",
    category: "Handicrafts",
    district: "Kot Esha",
    city: "Sylhet",
    since: 2019,
    orders: "70–110 orders/month",
    sales: [40000, 90000] as const,
  },
  {
    id: "usr_owner_05",
    name: "Rupomena Das",
    email: "owner05@smeconnect.local",
    phone: "+8801710000005",
    shopName: "Rongin Cosmetics",
    slug: "rongin-cosmetics",
    category: "Cosmetics",
    district: "Nawabganj",
    city: "Rajshahi",
    since: 2021,
    orders: "150–210 orders/month",
    sales: [60000, 120000] as const,
  },
  {
    id: "usr_owner_06",
    name: "Sabbir Hossain",
    email: "owner06@smeconnect.local",
    phone: "+8801710000006",
    shopName: "Gadget Bazar BD",
    slug: "gadget-bazar-bd",
    category: "Gadgets",
    district: "Khilgaon",
    city: "Dhaka",
    since: 2020,
    orders: "60–100 orders/month",
    sales: [90000, 180000] as const,
  },
  {
    id: "usr_owner_07",
    name: "Jhinuk Roy",
    email: "owner07@smeconnect.local",
    phone: "+8801710000007",
    shopName: "Gharer Sajano",
    slug: "gharer-sajano",
    category: "Home Décor",
    district: "Sadar",
    city: "Cumilla",
    since: 2022,
    orders: "40–80 orders/month",
    sales: [25000, 60000] as const,
  },
  {
    id: "usr_owner_08",
    name: "Karim Sheikh",
    email: "owner08@smeconnect.local",
    phone: "+8801710000008",
    shopName: "Chai Pathar",
    slug: "chai-pathar",
    category: "Food",
    district: "Kotwali",
    city: "Cumilla",
    since: 2023,
    orders: "30–60 orders/month",
    sales: [18000, 45000] as const,
  },
  {
    id: "usr_owner_09",
    name: "Alimul Haque",
    email: "owner09@smeconnect.local",
    phone: "+8801710000009",
    shopName: "Smart LED Corner",
    slug: "smart-led-corner",
    category: "Gadgets",
    district: "Sadar",
    city: "Rangpur",
    since: 2022,
    orders: "50–90 orders/month",
    sales: [50000, 110000] as const,
  },
  {
    id: "usr_owner_10",
    name: "Doli Akter",
    email: "owner10@smeconnect.local",
    phone: "+8801710000010",
    shopName: "Blooms & Stitches",
    slug: "blooms-and-stitches",
    category: "Fashion",
    district: "Sadar",
    city: "Barishal",
    since: 2023,
    orders: "25–55 orders/month",
    sales: [15000, 40000] as const,
  },
] as const;

const INVESTOR_SPECS = [
  {
    id: "usr_investor_01",
    name: "Rafiq Ahmed",
    email: "investor01@smeconnect.local",
    phone: "+8801810000001",
    min: 20000,
    max: 100000,
    categories: ["Food", "Fashion"],
    tenure: 90,
  },
  {
    id: "usr_investor_02",
    name: "Shahnewaz Chowdhury",
    email: "investor02@smeconnect.local",
    phone: "+8801810000002",
    min: 30000,
    max: 120000,
    categories: ["Handicrafts", "Home Décor"],
    tenure: 120,
  },
  {
    id: "usr_investor_03",
    name: "Ayesha Karim",
    email: "investor03@smeconnect.local",
    phone: "+8801810000003",
    min: 25000,
    max: 90000,
    categories: ["Cosmetics", "Food"],
    tenure: 60,
  },
  {
    id: "usr_investor_04",
    name: "Tanvir Hasan",
    email: "investor04@smeconnect.local",
    phone: "+8801810000004",
    min: 40000,
    max: 150000,
    categories: ["Gadgets", "Food"],
    tenure: 90,
  },
  {
    id: "usr_investor_05",
    name: "Nusrat Jahan",
    email: "investor05@smeconnect.local",
    phone: "+8801810000005",
    min: 20000,
    max: 75000,
    categories: ["Fashion", "Handicrafts"],
    tenure: 60,
  },
  {
    id: "usr_investor_06",
    name: "Jamal Uddin",
    email: "investor06@smeconnect.local",
    phone: "+8801810000006",
    min: 15000,
    max: 60000,
    categories: ["Food", "Gadgets"],
    tenure: 45,
  },
] as const;

export function buildDemoDataset(config: SeedConfig): DemoDataset {
  const { anchor } = config;

  const users: UserRow[] = [
    {
      id: "usr_admin_001",
      name: "SME Connect Admin",
      email: config.adminEmail,
      emailVerified: true,
      image: null,
      phone: "+8801900000001",
      phoneVerified: true,
      role: "ADMIN",
      status: "ACTIVE",
    },
    ...OWNER_SPECS.map(
      (spec): UserRow => ({
        id: spec.id,
        name: spec.name,
        email: "emailKey" in spec ? config.personalEmail : spec.email,
        emailVerified: true,
        image: publicImage(spec.id.replace("usr_owner_", "avatar"), "png"),
        phone: spec.phone,
        phoneVerified: true,
        role: "OWNER",
        status: spec.id === "usr_owner_10" ? "SUSPENDED" : "ACTIVE",
      }),
    ),
    ...INVESTOR_SPECS.map(
      (spec): UserRow => ({
        id: spec.id,
        name: spec.name,
        email: spec.email,
        emailVerified: true,
        image: publicImage(spec.id.replace("usr_investor_", "iav"), "png"),
        phone: spec.phone,
        phoneVerified: true,
        role: "INVESTOR",
        status: spec.id === "usr_investor_06" ? "SUSPENDED" : "ACTIVE",
      }),
    ),
  ];

  const accounts: AccountRow[] = users.map(
    (user): AccountRow => ({
      id: `acc_${user.id.replace("usr_", "")}`,
      accountId: user.id,
      providerId: "credential",
      password: config.passwordHash,
      userId: user.id,
    }),
  );

  const verificationStatusById = new Map<string, VerificationStatus>([
    ["usr_owner_01", "APPROVED"],
    ["usr_owner_02", "APPROVED"],
    ["usr_owner_03", "APPROVED"],
    ["usr_owner_04", "APPROVED"],
    ["usr_owner_05", "APPROVED"],
    ["usr_owner_06", "APPROVED"],
    ["usr_owner_07", "APPROVED"],
    ["usr_owner_08", "APPROVED"],
    ["usr_owner_09", "PENDING"],
    ["usr_owner_10", "REJECTED"],
    ["usr_investor_01", "APPROVED"],
    ["usr_investor_02", "APPROVED"],
    ["usr_investor_03", "APPROVED"],
    ["usr_investor_04", "APPROVED"],
    ["usr_investor_05", "PENDING"],
    ["usr_investor_06", "REJECTED"],
  ]);

  const verifications: UserVerificationRow[] = users
    .filter((user) => user.role !== "ADMIN")
    .map((user): UserVerificationRow => {
      const status = verificationStatusById.get(user.id) ?? "PENDING";
      const type: VerificationType = user.role === "OWNER" ? "OWNER" : "INVESTOR";
      const suffix = user.id.replace("usr_", "");
      const decided = status !== "PENDING";
      return {
        id: `uvr_${suffix}`,
        userId: user.id,
        type,
        status,
        idDocumentUrl: privateDocument(`${suffix}_nid`, "pdf"),
        salesProofUrls:
          type === "OWNER"
            ? [privateDocument(`${suffix}_sales1`, "jpg"), privateDocument(`${suffix}_sales2`, "jpg")]
            : [],
        shopLinks:
          type === "OWNER"
            ? [`https://www.facebook.com/${suffix}.shop`, `https://www.instagram.com/${suffix}.shop`]
            : [`https://www.linkedin.com/in/${suffix}`],
        reviewerId: decided ? "usr_admin_001" : null,
        reviewNote:
          status === "REJECTED"
            ? "Document image was unclear. Please resubmit with a readable copy."
            : decided
              ? "Documents and business links verified."
              : null,
        submittedAt: addDays(anchor, -20),
        reviewedAt: decided ? addDays(anchor, -18) : null,
      };
    });

  const businessProfiles: BusinessProfileRow[] = OWNER_SPECS.map(
    (spec, index): BusinessProfileRow => ({
      id: `biz_${spec.id.replace("usr_owner_", "owner")}`,
      ownerId: spec.id,
      shopName: spec.shopName,
      slug: spec.slug,
      category: spec.category,
      description:
        spec.id === "usr_owner_01"
          ? "Home-style Bangladeshi meal boxes run by Md. Fahim Bin Imam Nahid in Dhanmondi, Dhaka."
          : `${spec.shopName} is an established ${spec.category.toLowerCase()} shop serving customers across ${spec.city}.`,
      district: spec.district,
      city: spec.city,
      facebookUrl: `https://www.facebook.com/${spec.slug}`,
      instagramUrl: `https://www.instagram.com/${spec.slug}`,
      whatsappUrl: `https://wa.me/880171000000${index + 1}`,
      websiteUrl: null,
      runningSince: new Date(Date.UTC(spec.since, 0, 15)),
      monthlyOrdersRange: spec.orders,
      monthlySalesMinBdt: spec.sales[0],
      monthlySalesMaxBdt: spec.sales[1],
      growthStory:
        spec.id === "usr_owner_01"
          ? "Fahim started cooking for nearby hostels in 2022, then moved to WhatsApp pre-orders. Md. Fahim Bin Imam Nahid now packs 150 meal boxes a day with two helpers."
          : `${spec.shopName} grew from word-of-mouth orders into a steady online business with repeat customers.`,
      logoUrl: publicImage(spec.id.replace("usr_owner_", "bizlogo"), "png"),
      coverUrl: publicImage(spec.id.replace("usr_owner_", "bizcover"), "jpg"),
      trustScore: 0,
    }),
  );

  const productImages: ProductImageRow[] = OWNER_SPECS.flatMap((spec) =>
    [1, 2].map(
      (position): ProductImageRow => ({
        id: `pimg_${spec.id.replace("usr_owner_", "owner")}_${position}`,
        businessProfileId: `biz_${spec.id.replace("usr_owner_", "owner")}`,
        url: publicImage(`${spec.id.replace("usr_owner_", "product")}${position}`, "jpg"),
        caption: `${spec.shopName} product ${position}`,
        position,
      }),
    ),
  );

  const investorProfiles: InvestorProfileRow[] = INVESTOR_SPECS.map(
    (spec, index): InvestorProfileRow => ({
      id: `inv_${spec.id.replace("usr_investor_", "investor")}`,
      userId: spec.id,
      bio: `${spec.name} backs already-running online businesses in Bangladesh and prefers simple, transparent repayment plans.`,
      minLendBdt: spec.min,
      maxLendBdt: spec.max,
      preferredCategories: [...spec.categories],
      preferredTenureDays: spec.tenure,
      preferredRatePctMin: "10.00",
      preferredRatePctMax: "16.00",
      district: index % 2 === 0 ? "Dhanmondi" : "Gulshan",
      city: "Dhaka",
      trustScore: 0,
    }),
  );

  const loanRequests: LoanRequestRow[] = [
    {
      id: "lr_completed_01",
      ownerId: "usr_owner_01",
      amountBdt: 50000,
      purpose: "Eid meal-box expansion",
      fundUsage: "Buy insulated delivery bags, a second cooking pot and packaging for 150 daily boxes.",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      proposedRatePct: "14.50",
      proofUrls: [privateDocument("lr_completed_sales", "jpg")],
      status: "COMPLETED",
      publishedAt: addDays(anchor, -120),
    },
    {
      id: "lr_open_02",
      ownerId: "usr_owner_02",
      amountBdt: 35000,
      purpose: "Buy a commercial blender",
      fundUsage: "Replace the home blender so the kitchen can prepare 60 extra meal boxes each day.",
      tenureDays: 60,
      repaymentFrequency: "WEEKLY",
      proposedRatePct: "12.00",
      proofUrls: [privateDocument("lr_open_sales", "jpg")],
      status: "OPEN",
      publishedAt: addDays(anchor, -4),
    },
    {
      id: "lr_discussion_03",
      ownerId: "usr_owner_03",
      amountBdt: 75000,
      purpose: "Winter clothing stock",
      fundUsage: "Purchase woven sweaters and shawls from Chattogram suppliers before the season starts.",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      proposedRatePct: "13.50",
      proofUrls: [privateDocument("lr_discussion_sales", "jpg")],
      status: "IN_DISCUSSION",
      publishedAt: addDays(anchor, -12),
    },
    {
      id: "lr_funded_04",
      ownerId: "usr_owner_04",
      amountBdt: 60000,
      purpose: "Handloom material purchase",
      fundUsage: "Buy jute yarn and natural dye for the next craft fair order batch.",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      proposedRatePct: "14.00",
      proofUrls: [privateDocument("lr_funded_sales", "jpg")],
      status: "FUNDED",
      publishedAt: addDays(anchor, -7),
    },
    {
      id: "lr_repaying_05",
      ownerId: "usr_owner_05",
      amountBdt: 50000,
      purpose: "Cosmetics restock",
      fundUsage: "Restock fast-moving skin-care items ahead of the Eid campaign.",
      tenureDays: 28,
      repaymentFrequency: "WEEKLY",
      proposedRatePct: "14.50",
      proofUrls: [privateDocument("lr_repaying_sales", "jpg")],
      status: "REPAYING",
      publishedAt: addDays(anchor, -30),
    },
    {
      id: "lr_paused_06",
      ownerId: "usr_owner_06",
      amountBdt: 45000,
      purpose: "Phone accessory display",
      fundUsage: "Build a small display shelf and buy covers and chargers in bulk.",
      tenureDays: 60,
      repaymentFrequency: "BIWEEKLY",
      proposedRatePct: "15.00",
      proofUrls: [privateDocument("lr_paused_sales", "jpg")],
      status: "PAUSED",
      publishedAt: addDays(anchor, -20),
    },
    {
      id: "lr_cancelled_07",
      ownerId: "usr_owner_07",
      amountBdt: 25000,
      purpose: "Candle-making supplies",
      fundUsage: "Buy wax, wicks and jars for a small home-décor batch.",
      tenureDays: 30,
      repaymentFrequency: "WEEKLY",
      proposedRatePct: "12.50",
      proofUrls: [privateDocument("lr_cancelled_sales", "jpg")],
      status: "CANCELLED",
      publishedAt: addDays(anchor, -40),
    },
    {
      id: "lr_draft_08",
      ownerId: "usr_owner_08",
      amountBdt: 30000,
      purpose: "Tea and snack cart upgrade",
      fundUsage: "Add a covered display and a second kettle to the cart.",
      tenureDays: 45,
      repaymentFrequency: "WEEKLY",
      proposedRatePct: "13.00",
      proofUrls: [privateDocument("lr_draft_sales", "jpg")],
      status: "DRAFT",
      publishedAt: null,
    },
  ];

  const offers: OfferRow[] = [
    {
      id: "off_disc_01",
      loanRequestId: "lr_discussion_03",
      investorId: "usr_investor_01",
      amountBdt: 70000,
      interestRatePct: "13.50",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "I like the winter stock plan. I can support 70,000 taka first.",
      status: "COUNTERED",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 7),
      createdAt: addDays(anchor, -10),
    },
    {
      id: "off_disc_02",
      loanRequestId: "lr_discussion_03",
      investorId: "usr_investor_01",
      amountBdt: 75000,
      interestRatePct: "12.50",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "Could you consider 12.50 percent for the full amount?",
      status: "COUNTERED",
      parentOfferId: "off_disc_01",
      proposedBy: "OWNER",
      expiresAt: addDays(anchor, 6),
      createdAt: addDays(anchor, -8),
    },
    {
      id: "off_disc_03",
      loanRequestId: "lr_discussion_03",
      investorId: "usr_investor_01",
      amountBdt: 75000,
      interestRatePct: "13.00",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "I can meet you at 13.00 percent for 75,000 taka.",
      status: "PENDING",
      parentOfferId: "off_disc_02",
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 7),
      createdAt: addDays(anchor, -6),
    },
    {
      id: "off_disc_04",
      loanRequestId: "lr_discussion_03",
      investorId: "usr_investor_02",
      amountBdt: 75000,
      interestRatePct: "13.25",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "Happy to fund the full amount with monthly repayments.",
      status: "PENDING",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 5),
      createdAt: addDays(anchor, -5),
    },
    {
      id: "off_funded_01",
      loanRequestId: "lr_funded_04",
      investorId: "usr_investor_02",
      amountBdt: 60000,
      interestRatePct: "14.00",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "Approved after reviewing your craft fair orders.",
      status: "ACCEPTED",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 7),
      createdAt: addDays(anchor, -8),
    },
    {
      id: "off_funded_02",
      loanRequestId: "lr_funded_04",
      investorId: "usr_investor_03",
      amountBdt: 60000,
      interestRatePct: "16.00",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "Alternative offer with a higher rate.",
      status: "REJECTED",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 6),
      createdAt: addDays(anchor, -7),
    },
    {
      id: "off_repaying_01",
      loanRequestId: "lr_repaying_05",
      investorId: "usr_investor_04",
      amountBdt: 50000,
      interestRatePct: "14.50",
      tenureDays: 28,
      repaymentFrequency: "WEEKLY",
      message: "Weekly plan works for my portfolio.",
      status: "ACCEPTED",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 7),
      createdAt: addDays(anchor, -31),
    },
    {
      id: "off_completed_01",
      loanRequestId: "lr_completed_01",
      investorId: "usr_investor_01",
      amountBdt: 50000,
      interestRatePct: "14.50",
      tenureDays: 90,
      repaymentFrequency: "MONTHLY",
      message: "I can fund the Eid batch at 14.50 percent.",
      status: "ACCEPTED",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, -113),
      createdAt: addDays(anchor, -122),
    },
    {
      id: "off_open_withdrawn",
      loanRequestId: "lr_open_02",
      investorId: "usr_investor_02",
      amountBdt: 35000,
      interestRatePct: "12.00",
      tenureDays: 60,
      repaymentFrequency: "WEEKLY",
      message: "Withdrawn because another commitment came up.",
      status: "WITHDRAWN",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, 6),
      createdAt: addDays(anchor, -3),
    },
    {
      id: "off_open_expired",
      loanRequestId: "lr_open_02",
      investorId: "usr_investor_03",
      amountBdt: 35000,
      interestRatePct: "13.00",
      tenureDays: 60,
      repaymentFrequency: "WEEKLY",
      message: "This offer has passed its seven-day window.",
      status: "EXPIRED",
      parentOfferId: null,
      proposedBy: "INVESTOR",
      expiresAt: addDays(anchor, -1),
      createdAt: addDays(anchor, -9),
    },
  ];

  function loanTerms(
    id: string,
    requestId: string,
    offerId: string,
    ownerId: string,
    investorId: string,
    principalBdt: number,
    interestRatePct: string,
    tenureDays: number,
    repaymentFrequency: Frequency,
    startDate: Date | null,
    status: LoanStatus,
  ): { loan: LoanRow; agreement: AgreementRow } {
    const totalRepayableBdt = buildRepaymentSchedule({
      principalBdt,
      interestRatePct,
      tenureDays,
      repaymentFrequency,
      startDate: startDate ?? anchor,
    }).totalRepayableBdt;

    return {
      loan: {
        id,
        loanRequestId: requestId,
        offerId,
        ownerId,
        investorId,
        principalBdt,
        interestRatePct,
        tenureDays,
        repaymentFrequency,
        totalRepayableBdt,
        status,
        startDate,
      },
      agreement: {
        id: `agr_${id.replace("loan_", "")}`,
        loanId: id,
        termsSnapshot: {
          loanRequestId: requestId,
          offerId,
          principalBdt,
          interestRatePct,
          tenureDays,
          repaymentFrequency,
          totalRepayableBdt,
        },
        ownerConfirmedAt: startDate ? addDays(startDate, 1) : addDays(anchor, -6),
        investorConfirmedAt: startDate ? addDays(startDate, 2) : null,
      },
    };
  }

  const completedTerms = loanTerms(
    "loan_completed_01",
    "lr_completed_01",
    "off_completed_01",
    "usr_owner_01",
    "usr_investor_01",
    50000,
    "14.50",
    90,
    "MONTHLY",
    addDays(anchor, -120),
    "COMPLETED",
  );
  const fundedTerms = loanTerms(
    "loan_funded_04",
    "lr_funded_04",
    "off_funded_01",
    "usr_owner_04",
    "usr_investor_02",
    60000,
    "14.00",
    90,
    "MONTHLY",
    null,
    "PENDING_AGREEMENT",
  );
  const repayingTerms = loanTerms(
    "loan_repaying_05",
    "lr_repaying_05",
    "off_repaying_01",
    "usr_owner_05",
    "usr_investor_04",
    50000,
    "14.50",
    28,
    "WEEKLY",
    addDays(anchor, -28),
    "ACTIVE",
  );

  const loans: LoanRow[] = [completedTerms.loan, fundedTerms.loan, repayingTerms.loan];
  const agreements: AgreementRow[] = [
    completedTerms.agreement,
    fundedTerms.agreement,
    repayingTerms.agreement,
  ];

  const completedSchedule = buildRepaymentSchedule({
    principalBdt: 50000,
    interestRatePct: "14.50",
    tenureDays: 90,
    repaymentFrequency: "MONTHLY",
    startDate: addDays(anchor, -120),
  });
  const repayingSchedule = buildRepaymentSchedule({
    principalBdt: 50000,
    interestRatePct: "14.50",
    tenureDays: 28,
    repaymentFrequency: "WEEKLY",
    startDate: addDays(anchor, -28),
  });

  const repayingStatuses: RepaymentStatus[] = ["CONFIRMED", "OVERDUE", "MARKED_PAID", "UPCOMING"];
  const repayments: RepaymentRow[] = [
    ...completedSchedule.installments.map(
      (installment): RepaymentRow => ({
        id: `rep_completed_${installment.installmentNo}`,
        loanId: "loan_completed_01",
        installmentNo: installment.installmentNo,
        dueDate: installment.dueDate,
        amountBdt: installment.amountBdt,
        status: "CONFIRMED",
        markedPaidAt: addHours(installment.dueDate, -48),
        confirmedAt: addHours(installment.dueDate, -24),
        note: "Paid from Eid batch sales.",
        proofUrl: privateDocument(`rep_completed_${installment.installmentNo}`, "jpg"),
      }),
    ),
    ...repayingSchedule.installments.map(
      (installment, index): RepaymentRow => {
        const status = repayingStatuses[index];
        return {
          id: `rep_repaying_${installment.installmentNo}`,
          loanId: "loan_repaying_05",
          installmentNo: installment.installmentNo,
          dueDate: installment.dueDate,
          amountBdt: installment.amountBdt,
          status,
          markedPaidAt: status === "MARKED_PAID" ? addDays(anchor, -2) : null,
          confirmedAt: status === "CONFIRMED" ? addHours(installment.dueDate, -24) : null,
          note:
            status === "MARKED_PAID"
              ? "Paid today from cosmetic sales; awaiting investor confirmation."
              : status === "OVERDUE"
                ? "Payment is pending after the due date."
                : null,
          proofUrl:
            status === "MARKED_PAID" ? privateDocument("rep_repaying_proof", "jpg") : null,
        };
      },
    ),
  ];

  const posts: PostRow[] = [
    {
      id: "post_lr_completed_01",
      authorId: "usr_owner_01",
      type: "LOAN_REQUEST",
      content: "Md. Fahim Bin Imam Nahid is expanding Fahim's Home Kitchen with a ৳50,000 growth loan request.",
      imageUrls: [publicImage("post_lr_completed", "jpg")],
      loanRequestId: "lr_completed_01",
      deletedAt: null,
    },
    {
      id: "post_lr_open_02",
      authorId: "usr_owner_02",
      type: "LOAN_REQUEST",
      content: "Nusrat's Home Kitchen is looking for ৳35,000 to buy a commercial blender.",
      imageUrls: [],
      loanRequestId: "lr_open_02",
      deletedAt: null,
    },
    {
      id: "post_lr_discussion_03",
      authorId: "usr_owner_03",
      type: "LOAN_REQUEST",
      content: "Deshi Threads is discussing terms for a ৳75,000 winter stock loan.",
      imageUrls: [],
      loanRequestId: "lr_discussion_03",
      deletedAt: null,
    },
    {
      id: "post_lr_funded_04",
      authorId: "usr_owner_04",
      type: "LOAN_REQUEST",
      content: "Mati Crafts has accepted an offer and is finalising the agreement.",
      imageUrls: [],
      loanRequestId: "lr_funded_04",
      deletedAt: null,
    },
    {
      id: "post_lr_repaying_05",
      authorId: "usr_owner_05",
      type: "LOAN_REQUEST",
      content: "Rongin Cosmetics is repaying a ৳50,000 restocking loan weekly.",
      imageUrls: [],
      loanRequestId: "lr_repaying_05",
      deletedAt: null,
    },
    {
      id: "post_lr_paused_06",
      authorId: "usr_owner_06",
      type: "LOAN_REQUEST",
      content: "Gadget Bazar BD paused its display upgrade request.",
      imageUrls: [],
      loanRequestId: "lr_paused_06",
      deletedAt: addDays(anchor, -18),
    },
    {
      id: "post_lr_cancelled_07",
      authorId: "usr_owner_07",
      type: "LOAN_REQUEST",
      content: "Gharer Sajano cancelled its candle-making request.",
      imageUrls: [],
      loanRequestId: "lr_cancelled_07",
      deletedAt: addDays(anchor, -38),
    },
    {
      id: "post_update_personal_01",
      authorId: "usr_owner_01",
      type: "UPDATE",
      content:
        "Md. Fahim Bin Imam Nahid here — we crossed 150 meal boxes a day in Dhanmondi this week. Fahim Bin Imam thanks everyone who ordered during Eid.",
      imageUrls: [publicImage("post_personal_meals", "jpg")],
      loanRequestId: null,
      deletedAt: null,
    },
    {
      id: "post_update_owner02",
      authorId: "usr_owner_02",
      type: "UPDATE",
      content: "Our new biryani box sold out three days in a row. Adding a second cooking pot next week.",
      imageUrls: [],
      loanRequestId: null,
      deletedAt: null,
    },
    {
      id: "post_milestone_repaying_05",
      authorId: "usr_owner_05",
      type: "MILESTONE",
      content: "First two weekly repayments are complete. The Eid campaign went better than expected.",
      imageUrls: [publicImage("post_milestone_cosmetics", "jpg")],
      loanRequestId: null,
      deletedAt: null,
    },
    {
      id: "post_repayment_completed_01",
      authorId: "usr_owner_01",
      type: "REPAYMENT",
      content: "The final installment is confirmed. Nahid is ready to plan the next kitchen upgrade.",
      imageUrls: [],
      loanRequestId: null,
      deletedAt: null,
    },
    {
      id: "post_update_deleted_07",
      authorId: "usr_owner_07",
      type: "UPDATE",
      content: "Old promotional post kept for moderation history.",
      imageUrls: [],
      loanRequestId: null,
      deletedAt: addDays(anchor, -10),
    },
  ];

  const comments: CommentRow[] = [
    {
      id: "cmt_personal_investor_01",
      postId: "post_update_personal_01",
      authorId: "usr_investor_01",
      content: "Fahim Bin Imam, the packaging looks much better than last month. Well done.",
      deletedAt: null,
    },
    {
      id: "cmt_personal_owner02",
      postId: "post_update_personal_01",
      authorId: "usr_owner_02",
      content: "Nahid bhai, please save me two boxes for Friday if possible.",
      deletedAt: null,
    },
    {
      id: "cmt_deleted_01",
      postId: "post_update_personal_01",
      authorId: "usr_owner_03",
      content: "This comment was removed by its author.",
      deletedAt: addDays(anchor, -2),
    },
    {
      id: "cmt_open_01",
      postId: "post_lr_open_02",
      authorId: "usr_investor_02",
      content: "A commercial blender should noticeably increase your daily capacity.",
      deletedAt: null,
    },
  ];

  const likes: LikeRow[] = [
    { id: "lik_personal_inv01", postId: "post_update_personal_01", userId: "usr_investor_01" },
    { id: "lik_personal_owner02", postId: "post_update_personal_01", userId: "usr_owner_02" },
    { id: "lik_open_inv02", postId: "post_lr_open_02", userId: "usr_investor_02" },
    { id: "lik_open_inv03", postId: "post_lr_open_02", userId: "usr_investor_03" },
    { id: "lik_milestone_inv04", postId: "post_milestone_repaying_05", userId: "usr_investor_04" },
  ];

  const follows: FollowRow[] = [
    { id: "fol_inv01_owner01", followerId: "usr_investor_01", followeeId: "usr_owner_01" },
    { id: "fol_owner02_owner01", followerId: "usr_owner_02", followeeId: "usr_owner_01" },
    { id: "fol_owner03_inv01", followerId: "usr_owner_03", followeeId: "usr_investor_01" },
  ];

  const connections: ConnectionRow[] = [
    {
      id: "con_accepted_01",
      requesterId: "usr_investor_01",
      addresseeId: "usr_owner_01",
      status: "ACCEPTED",
      message:
        "Salam Md. Fahim Bin Imam Nahid, I enjoyed following your kitchen updates and would like to stay connected.",
    },
    {
      id: "con_pending_01",
      requesterId: "usr_owner_02",
      addresseeId: "usr_investor_02",
      status: "PENDING",
      message: "I would like to discuss the blender loan offer.",
    },
    {
      id: "con_declined_01",
      requesterId: "usr_owner_03",
      addresseeId: "usr_investor_03",
      status: "DECLINED",
      message: "Thank you for reaching out; the terms did not work for us.",
    },
  ];

  const conversations: ConversationRow[] = [
    {
      id: "conversation_01",
      participantOneId: "usr_investor_01",
      participantTwoId: "usr_owner_01",
    },
  ];

  const messages: MessageRow[] = [
    {
      id: "msg_01",
      conversationId: "conversation_01",
      senderId: "usr_investor_01",
      body: "Salam Fahim Bin Imam, thank you for completing the first loan so cleanly. Your updates were always on time.",
      readAt: addDays(anchor, -34),
      deletedAt: null,
    },
    {
      id: "msg_02",
      conversationId: "conversation_01",
      senderId: "usr_owner_01",
      body: "Rafiq bhai, Md. Fahim here. The packaging upgrade made a real difference for the Eid batch.",
      readAt: null,
      deletedAt: null,
    },
    {
      id: "msg_03",
      conversationId: "conversation_01",
      senderId: "usr_investor_01",
      body: "Let us talk about the next kitchen upgrade when you publish a draft.",
      readAt: null,
      deletedAt: null,
    },
  ];

  const messageDeletions: MessageDeletionRow[] = [
    { id: "msgdel_01", messageId: "msg_03", userId: "usr_investor_01" },
  ];

  const notificationSpecs: Array<{
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string;
    data: Prisma.InputJsonValue;
    read: boolean;
  }> = [
    {
      id: "ntf_offer_received",
      userId: "usr_owner_01",
      type: "OFFER_RECEIVED",
      title: "New offer received",
      body: "Rafiq Ahmed sent an offer on your Eid meal-box loan request.",
      link: "/offers/received",
      data: { loanRequestId: "lr_completed_01", offerId: "off_completed_01" },
      read: true,
    },
    {
      id: "ntf_offer_countered",
      userId: "usr_investor_01",
      type: "OFFER_COUNTERED",
      title: "Offer countered",
      body: "Deshi Threads countered your offer with revised terms.",
      link: "/offers/submitted",
      data: { offerId: "off_disc_02" },
      read: false,
    },
    {
      id: "ntf_offer_accepted",
      userId: "usr_owner_01",
      type: "OFFER_ACCEPTED",
      title: "Offer accepted",
      body: "Fahim Bin Imam, your accepted loan is now ready for agreement confirmation.",
      link: "/agreements/agr_completed_01",
      data: { offerId: "off_completed_01" },
      read: true,
    },
    {
      id: "ntf_agreement_confirmed",
      userId: "usr_owner_05",
      type: "AGREEMENT_CONFIRMED",
      title: "Agreement is active",
      body: "Both parties confirmed the restocking loan agreement.",
      link: "/loans/loan_repaying_05",
      data: { loanId: "loan_repaying_05" },
      read: true,
    },
    {
      id: "ntf_message_received",
      userId: "usr_owner_01",
      type: "MESSAGE_RECEIVED",
      title: "New message",
      body: "Rafiq Ahmed sent you a message about your kitchen updates.",
      link: "/conversations/conversation_01",
      data: { conversationId: "conversation_01", messageId: "msg_01" },
      read: true,
    },
    {
      id: "ntf_connection_request",
      userId: "usr_investor_02",
      type: "CONNECTION_REQUEST",
      title: "New connection request",
      body: "Nusrat's Home Kitchen would like to connect.",
      link: "/connections",
      data: { connectionId: "con_pending_01" },
      read: false,
    },
    {
      id: "ntf_connection_accepted",
      userId: "usr_investor_01",
      type: "CONNECTION_ACCEPTED",
      title: "Connection accepted",
      body: "Md. Fahim Bin Imam Nahid accepted your connection request.",
      link: "/connections/con_accepted_01",
      data: { connectionId: "con_accepted_01" },
      read: true,
    },
    {
      id: "ntf_verification_result",
      userId: "usr_owner_09",
      type: "VERIFICATION_RESULT",
      title: "Verification pending",
      body: "Your Smart LED Corner verification is in the admin review queue.",
      link: "/verifications/me",
      data: { verificationId: "uvr_owner_09" },
      read: false,
    },
    {
      id: "ntf_repayment_due",
      userId: "usr_owner_05",
      type: "REPAYMENT_DUE",
      title: "Repayment due soon",
      body: "Installment 4 of your restocking loan is due soon.",
      link: "/repayments/rep_repaying_4",
      data: { repaymentId: "rep_repaying_4" },
      read: false,
    },
    {
      id: "ntf_repayment_overdue",
      userId: "usr_owner_05",
      type: "REPAYMENT_OVERDUE",
      title: "Repayment overdue",
      body: "Installment 2 of your restocking loan is overdue.",
      link: "/repayments/rep_repaying_2",
      data: { repaymentId: "rep_repaying_2" },
      read: false,
    },
    {
      id: "ntf_repayment_marked_paid",
      userId: "usr_investor_04",
      type: "REPAYMENT_MARKED_PAID",
      title: "Payment marked as paid",
      body: "Rongin Cosmetics marked installment 3 as paid.",
      link: "/repayments/rep_repaying_3",
      data: { repaymentId: "rep_repaying_3" },
      read: false,
    },
    {
      id: "ntf_repayment_confirmed",
      userId: "usr_owner_01",
      type: "REPAYMENT_CONFIRMED",
      title: "Payment confirmed",
      body: "Your final Eid batch repayment was confirmed by Rafiq Ahmed.",
      link: "/repayments/rep_completed_3",
      data: { repaymentId: "rep_completed_3" },
      read: true,
    },
    {
      id: "ntf_new_comment",
      userId: "usr_owner_01",
      type: "NEW_COMMENT",
      title: "New comment",
      body: "Rafiq Ahmed commented on your kitchen update.",
      link: "/posts/post_update_personal_01",
      data: { postId: "post_update_personal_01", commentId: "cmt_personal_investor_01" },
      read: false,
    },
    {
      id: "ntf_new_like",
      userId: "usr_owner_01",
      type: "NEW_LIKE",
      title: "New like",
      body: "Nusrat Begum liked your kitchen update.",
      link: "/posts/post_update_personal_01",
      data: { postId: "post_update_personal_01" },
      read: true,
    },
  ];

  const notifications: NotificationRow[] = notificationSpecs.map(
    (spec): NotificationRow => ({
      id: spec.id,
      userId: spec.userId,
      type: spec.type,
      title: spec.title,
      body: spec.body,
      link: spec.link,
      data: spec.data,
      readAt: spec.read ? addDays(anchor, -1) : null,
    }),
  );

  const reviews: ReviewRow[] = [
    {
      id: "rev_completed_investor_to_owner",
      loanId: "loan_completed_01",
      reviewerId: "usr_investor_01",
      revieweeId: "usr_owner_01",
      rating: 5,
      comment:
        "Fahim Bin Imam ran a transparent loan: every update was clear and all three installments were on time.",
    },
    {
      id: "rev_completed_owner_to_investor",
      loanId: "loan_completed_01",
      reviewerId: "usr_owner_01",
      revieweeId: "usr_investor_01",
      rating: 5,
      comment: "Rafiq bhai was patient and fair. Md. Fahim would happily work together again.",
    },
  ];

  const reports: ReportRow[] = [
    {
      id: "rpt_open_01",
      reporterId: "usr_investor_02",
      targetType: "POST",
      targetId: "post_update_owner02",
      reason: "Please check whether the sales claim in this post is supported by proof.",
      status: "OPEN",
      resolutionNote: null,
      handledById: null,
    },
    {
      id: "rpt_resolved_01",
      reporterId: "usr_owner_03",
      targetType: "USER",
      targetId: "usr_owner_10",
      reason: "Repeated promotional messages after being asked to stop.",
      status: "RESOLVED",
      resolutionNote: "Account was suspended after review; no financial records were altered.",
      handledById: "usr_admin_001",
    },
    {
      id: "rpt_dismissed_01",
      reporterId: "usr_investor_03",
      targetType: "COMMENT",
      targetId: "cmt_deleted_01",
      reason: "Reported comment before the author removed it.",
      status: "DISMISSED",
      resolutionNote: "No policy violation found after the comment was removed.",
      handledById: "usr_admin_001",
    },
  ];

  const blocks: BlockRow[] = [
    { id: "blk_01", blockerId: "usr_owner_10", blockedId: "usr_investor_06" },
  ];

  return {
    users,
    accounts,
    verifications,
    businessProfiles,
    productImages,
    investorProfiles,
    loanRequests,
    offers,
    loans,
    agreements,
    repayments,
    posts,
    comments,
    likes,
    follows,
    connections,
    conversations,
    messages,
    messageDeletions,
    notifications,
    reviews,
    reports,
    blocks,
  };
}
