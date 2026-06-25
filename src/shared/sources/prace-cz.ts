import * as cheerio from 'cheerio';
import type { Job, Source } from './types.ts';

const QUERIES = [
  'social media manager',
  'content creator',
  'content manager',
  'community manager',
];

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchQuery(q: string): Promise<Job[]> {
  const url = `https://www.prace.cz/nabidky/?q[]=${encodeURIComponent(q)}&locality[place]=Praha&locality[radius]=20`;
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs,en' } });
  if (!res.ok) {
    console.error(`prace.cz ${q}: HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const out: Job[] = [];

  $('article').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a[href*="/nabidka/"], a[href*=".jobs.cz/pd/"], a[href*=".jobs.cz/rpd/"]').first();
    const href = link.attr('href');
    const title = link.text().trim() || $el.find('h2, h3').first().text().trim();
    if (!href || !title) return;

    const fullUrl = href.startsWith('http') ? href : `https://www.prace.cz${href}`;
    const id = `prace-cz:${fullUrl.replace(/[?#].*$/, '')}`;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    const company =
      $el.find('[data-link-type="company"], [class*="employer"], [class*="company"]').first().text().trim() || '';
    const location =
      $el.find('[data-link-type="locality"], [class*="locality"], [class*="location"]').first().text().trim() || '';

    out.push({
      id,
      source: 'prace.cz',
      title,
      company,
      location,
      url: fullUrl,
      description: text.slice(0, 600),
    });
  });

  return out;
}

export const praceCz: Source = {
  name: 'prace.cz',
  fetch: async () => {
    const results = await Promise.all(QUERIES.map(fetchQuery));
    const dedup = new Map<string, Job>();
    for (const j of results.flat()) dedup.set(j.id, j);
    return [...dedup.values()];
  },
};
