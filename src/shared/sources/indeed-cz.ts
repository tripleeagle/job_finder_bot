import * as cheerio from 'cheerio';
import type { Job, Source } from './types.ts';

// Note: Indeed fingerprints TLS (JA3/JA4) and HTTP/2 frame ordering, not just headers.
// Node's fetch is reliably blocked even when curl/Chrome with the same UA gets through.
// Getting past this needs curl-impersonate, undici with TLS tweaks, or a paid scraping API.
// Kept wired so logs make it obvious when it eventually unblocks; otherwise it no-ops.

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const QUERIES = [
  'social media manager',
  'content creator',
  'content manager',
  'community manager',
];

async function fetchQuery(q: string): Promise<Job[]> {
  const url = `https://cz.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Praha&fromage=14`;
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      'accept-language': 'cs-CZ,cs;q=0.9,en;q=0.8',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'sec-ch-ua': '"Chromium";v="120", "Not?A_Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    },
  });
  if (!res.ok) {
    console.error(`indeed.cz ${q}: HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  if (/captcha|hcaptcha|cf-challenge/i.test(html.slice(0, 4000))) {
    console.error(`indeed.cz ${q}: blocked by captcha`);
    return [];
  }

  const $ = cheerio.load(html);
  const out: Job[] = [];

  $('a[data-jk], a[href*="/rc/clk?jk="], a[href*="/viewjob?jk="]').each((_, el) => {
    const $el = $(el);
    const jk = $el.attr('data-jk') || (/[?&]jk=([a-zA-Z0-9]+)/.exec($el.attr('href') || '')?.[1] ?? '');
    const title = $el.text().trim() || $el.find('span').first().text().trim();
    if (!jk || !title) return;

    const card = $el.closest('[class*="job_seen_beacon"], [class*="result"], li, td');
    const company =
      card.find('[data-testid="company-name"], [class*="companyName"]').first().text().trim() ||
      card.find('span.companyName').first().text().trim();
    const location =
      card.find('[data-testid="text-location"], [class*="companyLocation"]').first().text().trim() ||
      card.find('div.companyLocation').first().text().trim();
    const snippet = card.find('[class*="snippet"], [class*="job-snippet"]').first().text().replace(/\s+/g, ' ').trim();

    const fullUrl = `https://cz.indeed.com/viewjob?jk=${jk}`;
    out.push({
      id: `indeed-cz:${jk}`,
      source: 'indeed.cz',
      title,
      company,
      location,
      url: fullUrl,
      description: [title, snippet].filter(Boolean).join(' | ').slice(0, 600),
    });
  });

  return out;
}

export const indeedCz: Source = {
  name: 'indeed.cz',
  fetch: async () => {
    const results: Job[] = [];
    // Run sequentially with a small delay — Indeed is more sensitive to parallel hits.
    for (const q of QUERIES) {
      results.push(...(await fetchQuery(q)));
      await new Promise((r) => setTimeout(r, 1500));
    }
    const dedup = new Map<string, Job>();
    for (const j of results) dedup.set(j.id, j);
    return [...dedup.values()];
  },
};
