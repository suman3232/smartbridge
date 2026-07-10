// Generates OfferBridge PWA icons from the brand logo mark. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// The bridge mark (matches src/components/brand/Logo.tsx), scaled into a 512 canvas.
const mark = (scale) => {
  const off = (512 - 40 * scale) / 2;
  return `
  <g transform="translate(${off} ${off}) scale(${scale})">
    <rect x="5" y="19" width="7" height="15" rx="2" fill="url(#mk)" opacity="0.92"/>
    <rect x="28" y="19" width="7" height="15" rx="2" fill="url(#mk)" opacity="0.92"/>
    <path d="M12 23.5C12 23.5 17.5 12.5 20 12.5C22.5 12.5 28 23.5 28 23.5" stroke="url(#mk)" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="20" cy="22" r="3.5" fill="#070d16" stroke="url(#mk)" stroke-width="2"/>
  </g>`;
};

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#111c31"/><stop offset="1" stop-color="#070b14"/>
    </linearGradient>
    <linearGradient id="mk" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3b82f6"/><stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>`;

// Rounded (purpose "any") — mark fills ~55%
const roundedSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="512" height="512" rx="104" fill="url(#bg)"/>
  <rect x="6" y="6" width="500" height="500" rx="98" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="2"/>
  ${mark(7)}
</svg>`;

// Maskable — full bleed square (opaque to the edge), mark inside the ~80% safe zone
const maskableSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  <rect width="512" height="512" fill="url(#bg)"/>
  ${mark(6)}
</svg>`;

async function png(svg, size, name) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(pub, name));
  console.log("wrote", name, `${size}x${size}`);
}

await png(roundedSvg, 192, "pwa-192x192.png");
await png(roundedSvg, 512, "pwa-512x512.png");
await png(maskableSvg, 512, "pwa-maskable-512x512.png");
await png(maskableSvg, 180, "apple-touch-icon.png");
await png(roundedSvg, 32, "favicon-32x32.png");

// SVG favicon (crisp in modern browsers)
import { writeFileSync } from "node:fs";
writeFileSync(join(pub, "favicon.svg"), roundedSvg);
console.log("wrote favicon.svg");
