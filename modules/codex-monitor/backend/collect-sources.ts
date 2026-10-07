import { load } from "cheerio";
import { sql } from "@aihot/backend/db";
import { guardedFetch } from "@aihot/backend/lib/http-fetch";
import { getTweet, tweetText, type SdTweet } from "@aihot/backend/providers/socialdata";
import { readXSearch } from "@aihot/backend/sources/x";
import { officialPageUrl, TRUSTED_HANDLES, type CollectionSource, type SourceContext, type SourceDocument, type SourceState } from "./collection-schema.ts";

export type PageFetcher = typeof guardedFetch;
const MAX_TEXT = 60_000;
const trusted = (author: string) => TRUSTED_HANDLES.some((handle) => handle.toLowerCase() === author.toLowerCase());
function exactPublication(value: string | null | undefined): string | null {
  if (!value || !/(?:Z|[+-]\d\d:?\d\d|GMT|UTC)$/i.test(value.trim())) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
const tidy = (value: string) => value.replace(/[\t\r ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
export function parseOfficialPage(html: string, url: string, observedAt: string): Omit<SourceDocument, "sourceKey"> {
  const $ = load(html);
  const publishedAt = exactPublication($("meta[property='article:published_time'], meta[name='datePublished']").first().attr("content"));
  $("script,style,nav,header,footer,noscript,form,button").remove();
  const root = $("article").first().length ? $("article").first() : $("main,[role='main']").first().length ? $("main,[role='main']").first() : $("body");
  root.find("p,li,h1,h2,h3,h4,br,div,section").append("\n");
  const text = tidy(root.text());
  if (!text || text.length > MAX_TEXT) throw new Error("source_text_missing_or_too_large");
  if (/^(?:just a moment|access denied|verify you are human|checking your browser)/i.test(tidy($("title").text())) || /enable javascript and cookies to continue/i.test(text)) throw new Error("source_requires_browser");
  return { key: url, url, author: "OpenAI", text, publishedAt, observedAt, context: [] };
}

async function readPage(url: string, observedAt: string, fetcher: PageFetcher) {
  const response = await fetcher(url, { timeoutMs: 20_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 3, redirectPolicy: "same-origin" });
  if (response.status !== 200) throw new Error(`source_http_${response.status}`);
  if (!officialPageUrl(response.url)) throw new Error("source_redirect_not_official");
  return { response, observedAt };
}

function asContext(tweet: SdTweet, relation: "reply" | "quote"): SourceContext {
  return { id: tweet.id_str, author: tweet.user.screen_name, url: `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`, text: tweetText(tweet).slice(0, 10_000), publishedAt: exactPublication(tweet.tweet_created_at), relation };
}

export async function readAnnouncementSource(source: CollectionSource, state: SourceState, observedAt: string, fetcher: PageFetcher = guardedFetch): Promise<{ documents: SourceDocument[]; receiptIds: number[]; patch: Partial<SourceState> }> {
  if (source.kind === "x_search") {
    const result = await readXSearch(`from:${source.handle}`, { lastId: state.cursor?.lastId ?? null, backlog: state.cursor?.backlog ?? [], subject: `codex-monitor:source:${source.id}` });
    const documents: SourceDocument[] = [];
    const receiptIds = new Set(result.receiptIds);
    for (const tweet of result.tweets) {
      if (!/^\d+$/.test(tweet.id_str) || tweet.user?.screen_name?.toLowerCase() !== source.handle.toLowerCase()) continue;
      const text = tweetText(tweet);
      if (!text || text.length > MAX_TEXT) continue;
      const context: SourceContext[] = [];
      if (tweet.quoted_status) context.push(asContext(tweet.quoted_status, "quote"));
      // Two reply ancestors cover short confirmations while bounding optional paid lookups.
      let parentId = tweet.in_reply_to_status_id_str;
      for (let depth = 0; parentId && /^\d+$/.test(parentId) && depth < 2; depth++) {
        const stored = await sql<{ body_text: string; author: string; url: string; published_at: Date | null }[]>`SELECT body_text, author, url, published_at FROM codex_monitor_documents WHERE document_key=${`x:${parentId}`} AND is_current LIMIT 1`;
        if (stored[0]) { context.push({ id: parentId, author: stored[0].author, url: stored[0].url, text: stored[0].body_text, publishedAt: stored[0].published_at?.toISOString() ?? null, relation: "reply" }); break; }
        const inBatch = result.tweets.find((post) => post.id_str === parentId);
        const subject = `codex-monitor:context:${parentId}`;
        const parent = inBatch ?? await getTweet(parentId, { purpose: "codex-monitor.context", subject });
        if (!inBatch) for (const receipt of await sql<{ id: number }[]>`SELECT id FROM receipts WHERE purpose='codex-monitor.context' AND subject=${subject} AND status='received'`) receiptIds.add(receipt.id);
        if (!parent || parent.id_str !== parentId) break;
        context.push(asContext(parent, "reply"));
        parentId = trusted(parent.user.screen_name) ? parent.in_reply_to_status_id_str : null;
      }
      documents.push({ key: `x:${tweet.id_str}`, sourceKey: source.id, url: `https://x.com/${source.handle}/status/${tweet.id_str}`, author: source.handle, text, publishedAt: exactPublication(tweet.tweet_created_at), observedAt, context });
    }
    documents.sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "") || a.key.length - b.key.length || a.key.localeCompare(b.key));
    const lastId = documents.reduce<string | null>((last, document) => {
      const id = document.key.slice(2);
      return last === null || BigInt(id) > BigInt(last) ? id : last;
    }, state.cursor?.lastId ?? null);
    return { documents, receiptIds: [...receiptIds], patch: { cursor: { lastId, backlog: result.backlog }, backlog: result.backlog.length, dropped: (state.dropped ?? 0) + result.dropped } };
  }
  const { response } = await readPage(source.url, observedAt, fetcher);
  if (source.kind === "official_page") return { documents: [{ ...parseOfficialPage(response.text(), source.url, observedAt), sourceKey: source.id }], receiptIds: [], patch: {} };
  const $ = load(response.text(), { xml: true });
  const entries = $("item,entry").toArray().slice(0, 40);
  if (!entries.length) throw new Error("source_feed_has_no_entries");
  const documents: SourceDocument[] = [];
  for (const entry of entries) {
    const node = $(entry);
    if (!/\bcodex\b/i.test(node.text())) continue;
    const url = node.find("link[rel='alternate']").attr("href") ?? node.find("link").first().attr("href") ?? node.find("link").first().text().trim();
    if (!officialPageUrl(url)) continue;
    const page = await readPage(url, observedAt, fetcher);
    const document = parseOfficialPage(page.response.text(), url, observedAt);
    document.publishedAt ??= exactPublication(node.find("pubDate,published").first().text());
    documents.push({ ...document, sourceKey: source.id });
  }
  return { documents, receiptIds: [], patch: {} };
}
