import { isIP } from "node:net";
import { SITE } from "@aihot/site";
import type { AdminSeo } from "@aihot/contracts/admin";
import { searchVerification } from "@aihot/contracts/seo";
import { config } from "../config.ts";
import { sql } from "../db.ts";
import { releasedCondition, selectedCondition } from "../publication/scope.ts";

/** Configuration and local publication evidence; external ownership/indexing is deliberately unknown. */
export async function seoOverview(): Promise<AdminSeo> {
  const origin = URL.parse(config.siteUrl);
  const now = new Date();
  const [counts] = await sql<{ indexable: number; selected: number }[]>`SELECT
    count(*) FILTER (WHERE p.visibility = 'public' AND p.indexable AND ${releasedCondition(now)})::int AS indexable,
    count(*) FILTER (WHERE ${selectedCondition(now)})::int AS selected FROM publications p`;
  const verification = searchVerification(process.env);
  const hostname = origin?.hostname ?? "";
  return {
    siteUrl: config.siteUrl, preview: process.env.SITE_PREVIEW === "true", https: origin?.protocol === "https:",
    publicOrigin: !!origin && !origin.username && !origin.password && origin.pathname === "/" && !origin.search && !origin.hash
      && hostname.includes(".") && !isIP(hostname) && !/(^|\.)(localhost|local|test|invalid|example)$/.test(hostname),
    locale: SITE.locale, title: SITE.homeTitle, description: SITE.description, contactConfigured: !!SITE.contactEmail,
    sitemap: `${config.siteUrl}/sitemap.xml`, robots: `${config.siteUrl}/robots.txt`,
    indexableArticles: counts!.indexable, selectedArticles: counts!.selected,
    verification: { google: { configured: !!verification.google, verified: null }, bing: { configured: !!verification.bing, verified: null } },
    indexNow: { enabled: config.indexNowSubmitEnabled, keyConfigured: !!config.indexNowKey },
  };
}
