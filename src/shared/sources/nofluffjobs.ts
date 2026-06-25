import type { Job, Source } from './types.ts';

const API = 'https://nofluffjobs.com/api/posting?criteria=country%3Dczechia&page=1';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

type Place = { city?: string; country?: { code?: string; name?: string } };
type ApiPosting = {
  id: string;
  name?: string;
  title?: string;
  url?: string;
  category?: string;
  seniority?: string[];
  flavors?: string[];
  fullyRemote?: boolean;
  regions?: string[];
  location?: { places?: Place[]; fullyRemote?: boolean };
};

// Categories within nofluffjobs that overlap with content/social media work.
const CATEGORIES = new Set(['marketing', 'sales-customer-service', 'business-analyst']);
const KEYWORDS = ['social', 'content', 'community', 'smm', 'marketing', 'ugc'];

export const noFluffJobs: Source = {
  name: 'nofluffjobs.com',
  fetch: async () => {
    const res = await fetch(API, {
      headers: { 'user-agent': UA, accept: 'application/json', 'accept-language': 'en,cs' },
    });
    if (!res.ok) {
      console.error(`nofluffjobs: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { postings?: ApiPosting[] };
    const postings = data.postings ?? [];
    const out: Job[] = [];
    const seen = new Set<string>();

    for (const p of postings) {
      const title = p.title;
      if (!title || !p.id) continue;

      // The API returns one entry per region/city for the same posting, and the
      // criteria=country=czechia hint is ignored — most rows are PL-only. Require
      // an actual CZ city among the places to keep the feed Czech-focused.
      const places = p.location?.places ?? [];
      const czCities = places
        .filter((pl) => (pl.country?.code || '').toLowerCase() === 'cz')
        .map((pl) => pl.city)
        .filter((x): x is string => !!x);
      if (czCities.length === 0) continue;

      const inCategory = p.category && CATEGORIES.has(p.category.toLowerCase());
      const hay = `${title} ${(p.flavors ?? []).join(' ')}`.toLowerCase();
      const hasKeyword = KEYWORDS.some((k) => hay.includes(k));
      if (!inCategory && !hasKeyword) continue;

      // Dedupe across the per-region duplicates by company+title.
      const dedupKey = `nofluffjobs:${(p.name ?? '').toLowerCase()}|${title.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const slug = p.url || p.id;
      const fullUrl = `https://nofluffjobs.com/job/${slug}`;
      const idKey = dedupKey;
      const remote = p.fullyRemote || p.location?.fullyRemote;
      const location = [...new Set(czCities)].join(', ') + (remote ? ' (Remote)' : '');

      const description = [p.category, (p.flavors ?? []).join(', '), (p.seniority ?? []).join(', ')]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 600);

      out.push({
        id: idKey,
        source: 'nofluffjobs.com',
        title,
        company: p.name ?? '',
        location,
        url: fullUrl,
        description,
        employmentType: (p.seniority ?? []).join(', ') || undefined,
      });
    }

    return out;
  },
};
