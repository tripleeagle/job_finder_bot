import * as cheerio from 'cheerio';
import type { Job, Source } from './types.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const QUERIES = [
  'social media',
  'content creator',
  'content manager',
  'community manager',
  'SMM',
];

async function fetchQuery(q: string): Promise<Job[]> {
  const url = `https://www.profesia.cz/prace/praha/?search_anywhere=${encodeURIComponent(q)}&sort_by=relevance`;
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'cs,en;q=0.9', accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.error(`profesia.cz ${q}: HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const out: Job[] = [];

  $('.list-row').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a[href*="/prace/"]').first();
    const href = link.attr('href');
    const title = link.text().trim();
    if (!href || !title) return;
    if (/email|alert|notifikac/i.test($el.text())) return; // skip email-alert promo row

    const fullUrl = href.startsWith('http') ? href : `https://www.profesia.cz${href}`;
    const id = `profesia-cz:${fullUrl.replace(/[?#].*$/, '')}`;

    // The cheerio sample shows raw text: "TitleCompanyLocation Date Save"
    // Pull explicit fields where possible, falling back to text parsing.
    const text = $el.text().replace(/\s+/g, ' ').trim();
    const company = $el.find('.offer-company, [class*="company"]').first().text().trim();
    const location = $el.find('.offer-locality, [class*="locality"], [class*="location"]').first().text().trim();

    out.push({
      id,
      source: 'profesia.cz',
      title,
      company,
      location,
      url: fullUrl,
      description: text.slice(0, 600),
    });
  });

  return out;
}

export const profesiaCz: Source = {
  name: 'profesia.cz',
  fetch: async () => {
    const results = await Promise.all(QUERIES.map(fetchQuery));
    const dedup = new Map<string, Job>();
    for (const j of results.flat()) dedup.set(j.id, j);
    return [...dedup.values()];
  },
};
