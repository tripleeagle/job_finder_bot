import type { Job, Source } from './types.ts';

const API = 'https://core.startupjobs.cz/api/search/offers';
const QUERIES = ['social media', 'content creator', 'content manager', 'community manager', 'smm'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

type ApiOffer = {
  id: string;
  displayId: number;
  slug?: string;
  kind: string;
  company?: { name?: string; slug?: string };
  contract?: string[];
  employmentType?: string[];
  locationPreference?: string[];
  locations?: Array<{ name?: { cs?: string | null; en?: string | null } }>;
  title?: { cs?: string | null; en?: string | null };
  description?: { cs?: string | null; en?: string | null };
};

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

async function fetchQuery(q: string): Promise<Job[]> {
  const url = new URL(API);
  url.searchParams.append('fulltext[]', q);
  url.searchParams.append('employmentType[]', 'full-time');
  url.searchParams.append('seniority[]', 'junior');
  url.searchParams.append('seniority[]', 'medior');
  url.searchParams.set('itemsPerPage', '40');

  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/ld+json' } });
  if (!res.ok) {
    console.error(`startupjobs.cz ${q}: HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { member?: ApiOffer[] };
  const offers = data.member ?? [];
  const out: Job[] = [];

  for (const o of offers) {
    const title = o.title?.cs || o.title?.en || '';
    if (!title || !o.displayId) continue;
    const slug = o.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const url = `https://www.startupjobs.cz/nabidka/${o.displayId}/${slug}`;
    const locations = (o.locations ?? [])
      .map((l) => l.name?.cs || l.name?.en)
      .filter((x): x is string => !!x);
    const locPref = o.locationPreference ?? [];
    const locationStr = [...locations, ...locPref].join(', ') || (locPref.includes('remote') ? 'Remote' : '');
    const description = stripHtml(o.description?.cs || o.description?.en || '').slice(0, 600);

    out.push({
      id: `startupjobs:${o.id}`,
      source: 'startupjobs.cz',
      title,
      company: o.company?.name ?? '',
      location: locationStr,
      url,
      description,
      employmentType: 'HPP / full-time',
    });
  }

  return out;
}

export const startupJobsCz: Source = {
  name: 'startupjobs.cz',
  fetch: async () => {
    const results = await Promise.all(QUERIES.map(fetchQuery));
    const dedup = new Map<string, Job>();
    for (const j of results.flat()) dedup.set(j.id, j);
    return [...dedup.values()];
  },
};
