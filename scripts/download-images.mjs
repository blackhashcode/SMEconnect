/**
 * Downloads every image referenced by the exported Stitch screens into
 * public/images and generates src/data/images.ts with semantic aliases.
 *
 * Source: stitch-export/image-catalog.json (generated from the Stitch HTML).
 * Run: npm run fetch:images
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "stitch-export", "image-catalog.json");
const IMAGE_DIR = path.join(ROOT, "public", "images");
const OUTPUT_TS = path.join(ROOT, "src", "data", "images.ts");

// Semantic names keyed by `screen-folder|img-index` from the catalog.
const NAMES = {
  "01-sign-up-role-selection|0": "boutique-sarees",
  "01-sign-up-role-selection|1": "investor-mobile",

  "02-home-feed|2": "nusrat-kitchen-wide",
  "02-home-feed|3": "tanvir-fabric",
  "02-home-feed|4": "farzana-pottery-wide",
  "02-home-feed|5": "leather-bag",
  "02-home-feed|6": "agritech-strawberries",
  "02-home-feed|7": "electric-courier",
  "02-home-feed|8": "nusrat-portrait",
  "02-home-feed|9": "nusrat-avatar",
  "02-home-feed|10": "tanvir-portrait",
  "02-home-feed|11": "jamdani-panjabi",
  "02-home-feed|12": "handloom-loom",
  "02-home-feed|13": "handloom-panjabis",
  "02-home-feed|14": "farzana-portrait",
  "02-home-feed|15": "terracotta-tableware",
  "02-home-feed|16": "investor-senior",
  "02-home-feed|17": "bella-organics-products",
  "02-home-feed|18": "electric-fleet",
  "02-home-feed|19": "nusrat-bakery-boxes",
  "02-home-feed|20": "rafiq-portrait",
  "02-home-feed|21": "samira-portrait",
  "02-home-feed|22": "tanzeem-portrait",

  "03-create-loan-offer-modal|2": "nusrat-portrait-warm",
  "03-create-loan-offer-modal|3": "nusrat-headshot",

  "04-investor-dashboard|2": "rafiq-portrait-pro",
  "04-investor-dashboard|3": "nusrat-bakery",
  "04-investor-dashboard|4": "tanvir-textiles",
  "04-investor-dashboard|5": "arif-fleet",
  "04-investor-dashboard|6": "sabrina-skincare",
  "04-investor-dashboard|7": "kamal-honey",
  "04-investor-dashboard|8": "potter-sylhet",

  "05-review-loan-offer-negotiate|2": "rafiq-portrait-navy",

  "06-landing-page|2": "landing-baker",
  "06-landing-page|3": "landing-garment",
  "06-landing-page|4": "landing-pottery",
  "06-landing-page|5": "nusrat-cloud-kitchen",
  "06-landing-page|6": "pastry-boxes",
  "06-landing-page|7": "boutique-punjabis",
  "06-landing-page|8": "tanvir-navy-punjabi",
  "06-landing-page|9": "catering-desserts",
  "06-landing-page|10": "nusrat-culinary",
  "06-landing-page|11": "terracotta-cups",
  "06-landing-page|12": "farzana-studio",

  "07-notifications-center|2": "tanvir-investor",
  "07-notifications-center|3": "nusrat-founder",
  "07-notifications-center|4": "farzana-craft",
  "07-notifications-center|5": "rafiq-shopkeeper",
  "07-notifications-center|6": "electronics-distributor",

  "08-admin-verification-panel|2": "admin-applicant-1",
  "08-admin-verification-panel|3": "admin-applicant-2",
  "08-admin-verification-panel|4": "admin-cargo-logo",
  "08-admin-verification-panel|5": "admin-applicant-3",
  "08-admin-verification-panel|6": "admin-applicant-4",
  "08-admin-verification-panel|7": "admin-nusrat",

  "09-messages-loan-offers|2": "nusrat-closeup",
  "09-messages-loan-offers|3": "tanvir-fashion",
  "09-messages-loan-offers|4": "farzana-pottery-closeup",
  "09-messages-loan-offers|5": "samira-investor",
  "09-messages-loan-offers|6": "nusrat-headshot-2",
  "09-messages-loan-offers|7": "nusrat-avatar-2",
  "09-messages-loan-offers|8": "nusrat-avatar-3",
  "09-messages-loan-offers|9": "nusrat-avatar-4",
  "09-messages-loan-offers|10": "nusrat-profile",

  "10-loan-agreement-summary-confirmation|0": "nusrat-agreement",
  "10-loan-agreement-summary-confirmation|1": "rafiq-agreement",

  "11-business-profile-page|2": "nusrat-profile-closeup",
  "11-business-profile-page|3": "nusrat-kitchen-tarts",
  "11-business-profile-page|4": "brownies",
  "11-business-profile-page|5": "saffron-cups",
  "11-business-profile-page|6": "gift-hamper",
  "11-business-profile-page|7": "savory-pies",
  "11-business-profile-page|8": "avatar-male-1",
  "11-business-profile-page|9": "avatar-female-1",
  "11-business-profile-page|10": "avatar-male-2",

  "12-investor-profile-page|2": "rafiq-profile",
  "12-investor-profile-page|3": "boutique-shopfront",
  "12-investor-profile-page|4": "cloud-kitchen",
  "12-investor-profile-page|5": "terracotta-craft",
  "12-investor-profile-page|6": "organic-skincare",
  "12-investor-profile-page|7": "entrepreneur-kitchen",
  "12-investor-profile-page|8": "fashion-founder",
  "12-investor-profile-page|9": "samira-profile",
  "12-investor-profile-page|10": "tanzeem-profile",

  "13-explore-search|2": "weaver-sarees",
  "13-explore-search|3": "entrepreneur-indigo",
  "13-explore-search|4": "bakery-counter",
  "13-explore-search|5": "home-chef",
  "13-explore-search|6": "terracotta-glazed",
  "13-explore-search|7": "clay-artisan",
  "13-explore-search|8": "organic-cosmetics",
  "13-explore-search|9": "cosmetologist",
  "13-explore-search|10": "cargo-bikes",
  "13-explore-search|11": "tech-entrepreneur",
  "13-explore-search|12": "honey-jars",
  "13-explore-search|13": "beekeeper",

  "14-create-loan-request|0": "artisan-workshop",
  "14-create-loan-request|1": "silk-spools",

  "15-business-owner-dashboard|2": "nusrat-dashboard",
  "15-business-owner-dashboard|3": "deck-oven",
  "15-business-owner-dashboard|4": "rafiq-dashboard",
  "15-business-owner-dashboard|5": "samira-dashboard",
  "15-business-owner-dashboard|6": "tanzeem-dashboard",
};

const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
await fs.mkdir(IMAGE_DIR, { recursive: true });

function extensionFor(bytes, contentType) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function download(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SMEconnect asset export)" },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      return { bytes, ext: extensionFor(bytes, response.headers.get("content-type") || "") };
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  throw new Error("unreachable");
}

const byUrl = new Map();
const aliases = new Map();

for (const entry of catalog) {
  let name = NAMES[`${entry.screen}|${entry.index}`];
  if (entry.alt === "SME Connect Logo") name = "logo";
  else if (entry.alt === "Profile") name = "avatar-placeholder";
  if (!name) {
    const fromAlt = entry.alt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 44);
    name = fromAlt ? `${fromAlt}-${entry.index}` : `${entry.screen}-${entry.index}`;
  }

  if (!byUrl.has(entry.url)) {
    byUrl.set(entry.url, { name, ext: null, bytes: null });
  }
  if (!aliases.has(name)) aliases.set(name, byUrl.get(entry.url));
  else if (aliases.get(name) !== byUrl.get(entry.url)) {
    let suffix = 2;
    while (aliases.has(`${name}-${suffix}`)) suffix += 1;
    aliases.set(`${name}-${suffix}`, byUrl.get(entry.url));
  }
}

let done = 0;
for (const [url, asset] of byUrl) {
  const { bytes, ext } = await download(url);
  asset.ext = ext;
  asset.bytes = bytes;
  const file = `${asset.name}.${ext}`;
  await fs.writeFile(path.join(IMAGE_DIR, file), bytes);
  done += 1;
  if (done % 20 === 0) console.log(`Downloaded ${done}/${byUrl.size} images`);
}

const lines = [
  "// Generated by scripts/download-images.mjs. Do not edit by hand.",
  "export const images = {",
];
for (const [name, asset] of [...aliases.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`  ${JSON.stringify(name)}: "/images/${name}.${asset.ext}",`);
}
lines.push("} as const;");
lines.push("");
lines.push("export type ImageKey = keyof typeof images;");
lines.push("");
await fs.mkdir(path.dirname(OUTPUT_TS), { recursive: true });
await fs.writeFile(OUTPUT_TS, lines.join("\n"));

console.log(`Downloaded ${byUrl.size} unique images and generated ${aliases.size} aliases.`);
