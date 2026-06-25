import * as cheerio from 'cheerio';
import type { Job, Source } from './types.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const PAGES = [1, 2, 3];

async function fetchPage(page: number): Promise<Job[]> {
  const url = page === 1 ? 'https://cocuma.cz/jobs/' : `https://cocuma.cz/jobs/page/${page}/`;
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'cs,en' } });
  if (!res.ok) {
    console.error(`cocuma.cz page ${page}: HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const out: Job[] = [];

  $('a[href*="/job/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || !href.includes('/job/')) return;

    const fullUrl = href.startsWith('http') ? href : `https://cocuma.cz${href}`;
    const id = `cocuma-cz:${fullUrl.replace(/[?#].*$/, '').replace(/\/$/, '')}`;

    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    const title =
      $el.find('h2, h3, [class*="title"], [class*="position"]').first().text().trim() ||
      text.split(/[\n·•|]/)[0]?.trim() ||
      '';
    const company =
      $el.find('[class*="company"], [class*="employer"]').first().text().trim() || '';
    const location =
      $el.find('[class*="location"], [class*="place"], [class*="city"]').first().text().trim() || '';
    const employmentType =
      $el.find('[class*="employment"], [class*="contract"], [class*="type"]').first().text().trim() || '';

    if (!title) return;

    out.push({
      id,
      source: 'cocuma.cz',
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

export const cocumaCz: Source = {
  name: 'cocuma.cz',
  fetch: async () => {
    const results = await Promise.all(PAGES.map(fetchPage));
    const dedup = new Map<string, Job>();
    for (const j of results.flat()) dedup.set(j.id, j);
    return [...dedup.values()];
  },
};
