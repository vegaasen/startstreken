/**
 * Build-time script: generates public/sitemap.xml from src/data/arrangements.json.
 *
 * Usage:
 *   bun scripts/generate-sitemap.ts
 *
 * Run automatically as part of `bun run build` via the prebuild script.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import ritt from "../src/data/arrangements.json" with { type: "json" };

// Punycode form — XML should use ASCII-safe URLs.
const BASE_URL = "https://www.xn--lypevaer-d8a.no";

type RittEntry = {
  id: string;
  officialDate: string;
};

const today = new Date().toISOString().split("T")[0];

const urls: string[] = [
  // Homepage
  `  <url>
    <loc>${BASE_URL}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,

  // GPX upload page
  `  <url>
    <loc>${BASE_URL}/gpx</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,

  // One entry per arrangement
  ...(ritt as RittEntry[]).map(
    (r) => `  <url>
    <loc>${BASE_URL}/arrangement/${r.id}</loc>
    <lastmod>${r.officialDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

const outPath = resolve(import.meta.dirname, "../public/sitemap.xml");
writeFileSync(outPath, xml, "utf-8");
console.log(`Sitemap written to ${outPath} (${(ritt as RittEntry[]).length + 2} URLs)`);
