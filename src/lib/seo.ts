/**
 * Shared SEO constants — single source of truth for canonical URLs,
 * sitemap generation, and Open Graph tags.
 */

/** Canonical base URL (unicode form, for meta tags / OG). No trailing slash. */
export const SITE_URL = "https://www.løypevær.no";

/** ASCII-safe (punycode) base URL for XML sitemap and robots.txt. No trailing slash. */
export const SITE_URL_ASCII = "https://www.xn--lypevaer-d8a.no";

/**
 * Map internal discipline keys to English sport names for Schema.org.
 */
export function disciplineToSport(discipline: string): string {
  switch (discipline) {
    case "landevei":
      return "Road Cycling";
    case "terreng":
      return "Mountain Biking";
    case "langrenn":
      return "Cross-Country Skiing";
    case "triathlon":
      return "Triathlon";
    case "ultraløp":
      return "Ultramarathon";
    default:
      return "Endurance Sports";
  }
}
