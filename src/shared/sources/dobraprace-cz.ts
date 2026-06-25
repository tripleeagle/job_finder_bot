import * as cheerio from 'cheerio';
import type { Job, Source } from './types.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Marketing/media category, Prague locality.
const URLS = [
  'https://www.dobraprace.cz/marketing-media/?lokalita=praha',
  'https://www.dobraprace.cz/marketing-media/?lokalita=praha&strana=2',
];

async function fetchListing(url: string): Promise<Job[]> {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs,en' } });
  if (!res.ok) {
    console.error(`dobraprace.cz ${url}: HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const out: Job[] = [];

  $('article, [class*="job"], [class*="offer"], [class*="nabidka"], li').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a[href*="/nabidka"], a[href*="/job"], h2 a, h3 a').first();
    const href = link.attr('href');
    const title = link.text().trim() || $el.find('h2, h3').first().text().trim();
    if (!href || !title) return;

    const fullUrl = href.startsWith('http') ? href : `https://www.dobraprace.cz${href}`;
    if (!/dobraprace\.cz/.test(fullUrl)) return;

    const id = `dobraprace-cz:${fullUrl.replace(/[?#].*$/, '')}`;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    const company =
      $el.find('[class*="firma"], [class*="company"], [class*="employer"]').first().text().trim() || '';
    const location =
      $el.find('[class*="lokalita"], [class*="location"], [class*="misto"]').first().text().trim() || '';
    const employmentType =
      $el.find('[class*="uvazek"], [class*="employment"]').first().text().trim() || '';

    out.push({
      id,
      source: 'dobraprace.cz',
      title,
      company,
      location,
      url: fullUrl,
      description: text.slice(0, 600),
      employmentType: employmentType || undefined,
    });
  });

  return out;
}

export const dobraPraceCz: Source = {
  name: 'dobraprace.cz',
  fetch: async () => {
    const results = await Promise.all(URLS.map(fetchListing));
    const dedup = new Map<string, Job>();
    for (const j of results.flat()) dedup.set(j.id, j);
    return [...dedup.values()];
  },
};
