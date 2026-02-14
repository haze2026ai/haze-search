import { load } from 'cheerio';
import { fetch } from 'undici';
import pLimit from 'p-limit';
import { PageDoc } from '../domain/types.js';

export type CrawlOptions = {
  seedUrls: string[];
  allowHosts?: string[];
  maxPages: number;
  maxDepth: number;
  rateLimitMs: number;
  userAgent: string;
};

export type CrawlProgress = {
  queued: number;
  fetched: number;
  indexed: number;
  errors: number;
};

export type CrawlHandler = (doc: PageDoc) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function extractText(html: string) {
  const $ = load(html);
  $('script, style, noscript').remove();
  const title = $('title').text().trim();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return { title, text };
}

function extractLinks(html: string, baseUrl: string) {
  const $ = load(html);
  const links = new Set<string>();
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const u = new URL(href, baseUrl);
      const norm = normalizeUrl(u.toString());
      if (norm) links.add(norm);
    } catch {}
  });
  return [...links];
}

function allowed(url: string, allowHosts?: string[]) {
  if (!allowHosts || allowHosts.length === 0) return true;
  try {
    const host = new URL(url).hostname;
    return allowHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function crawl(opts: CrawlOptions, onDoc: CrawlHandler, onProgress: (p: CrawlProgress) => void) {
  const queue: Array<{ url: string; depth: number }> = [];
  const seen = new Set<string>();
  for (const u of opts.seedUrls) {
    const nu = normalizeUrl(u);
    if (nu && allowed(nu, opts.allowHosts)) {
      queue.push({ url: nu, depth: 0 });
      seen.add(nu);
    }
  }

  const progress: CrawlProgress = { queued: queue.length, fetched: 0, indexed: 0, errors: 0 };
  const limit = pLimit(3);

  while (queue.length > 0 && progress.indexed < opts.maxPages) {
    const batch = queue.splice(0, 3);
    progress.queued = queue.length;

    await Promise.all(
      batch.map(({ url, depth }) =>
        limit(async () => {
          try {
            await sleep(opts.rateLimitMs);
            const res = await fetch(url, { headers: { 'User-Agent': opts.userAgent } });
            if (!res.ok) return;
            const html = await res.text();
            progress.fetched += 1;
            const { title, text } = extractText(html);
            if (text.length > 0) {
              onDoc({ url, title, content: text, fetchedAt: new Date().toISOString() });
              progress.indexed += 1;
            }
            if (depth < opts.maxDepth) {
              const links = extractLinks(html, url);
              for (const link of links) {
                if (progress.indexed + queue.length >= opts.maxPages) break;
                if (!seen.has(link) && allowed(link, opts.allowHosts)) {
                  seen.add(link);
                  queue.push({ url: link, depth: depth + 1 });
                }
              }
            }
          } catch {
            progress.errors += 1;
          } finally {
            onProgress({ ...progress, queued: queue.length });
          }
        })
      )
    );
  }
}
