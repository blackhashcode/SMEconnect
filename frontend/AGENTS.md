# SME Connect — build rules

- Stitch designs (via the Stitch MCP) are VISUAL REFERENCES, not code to copy.
- Never paste Stitch HTML directly. Rebuild screens with reusable components.
- One shared theme: put Stitch's colors, fonts, radius and spacing tokens in a
  single tailwind.config, not repeated per page.
- Extract repeated UI into components (Header, Footer, LoanCard, ShopCard,
  StatCard, ProfileHeader, VerifiedBadge, ProgressBar, etc.) before building pages.
- Move all mock data (shops, investors, loans) into /data or the database seed,
  never hardcoded in JSX.
- The product is a LinkedIn-style network: investors CONNECT with shop owners and
  make loan OFFERS. It is NOT crowdfunding. Replace any "Back ৳X" / syndicate /
  escrow wording with Connect / Make an offer.
- Logged-out pages use the public header (Log in / Sign up); app pages use the
  logged-in header.
- Download all images from Stitch into /public; don't link to googleusercontent URLs.
- Keep numbers consistent across screens.