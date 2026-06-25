import type { Job, Source } from './types.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// Companies whose Greenhouse board has (occasionally or regularly) shown Prague roles.
// Order doesn't matter; each board is fetched independently and filtered by location/office.
const BOARDS = [
  { slug: 'jetbrains', name: 'JetBrains' },
  { slug: 'emplifi', name: 'Emplifi' },
  { slug: 'mewssystems', name: 'Mews' },
  { slug: 'boku', name: 'Boku' },
  { slug: 'salesloft', name: 'Salesloft' },
  { slug: 'gitlab', name: 'GitLab' },
  { slug: 'datadog', name: 'Datadog' },
  { slug: 'hubspot', name: 'HubSpot' },
];

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  offices?: Array<{ name?: string; location?: string }>;
  departments?: Array<{ name?: string }>;
  company_name?: string;
  updated_at?: string;
};

const PRAGUE_RE = /\b(pra(g|h)|prague|praha|czech|česko|česk[áé]\s*republik)/i;
const REMOTE_RE = /\b(remote|anywhere|emea|europe|eu only|wfh)\b/i;

async function fetchBoard(slug: string, displayName: string): Promise<Job[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`greenhouse:${slug}: HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { jobs?: GhJob[] };
  const out: Job[] = [];

  for (const j of data.jobs ?? []) {
    const locStr = [
      j.location?.name,
      ...(j.offices ?? []).map((o) => `${o.name ?? ''} ${o.location ?? ''}`),
    ]
      .filter(Boolean)
      .join(' | ');

    const isPrague = PRAGUE_RE.test(locStr);
    const isRemoteEu = REMOTE_RE.test(locStr);
    if (!isPrague && !isRemoteEu) continue;

    out.push({
      id: `greenhouse:${slug}:${j.id}`,
      source: `greenhouse/${displayName}`,
      title: j.title,
      company: j.company_name || displayName,
      location: locStr || (isRemoteEu ? 'Remote' : ''),
      url: j.absolute_url,
      description: [j.title, (j.departments ?? []).map((d) => d.name).filter(Boolean).join(', '), locStr]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 600),
    });
  }
  return out;
}

export const greenhouse: Source = {
  name: 'greenhouse',
  fetch: async () => {
    const results = await Promise.all(BOARDS.map((b) => fetchBoard(b.slug, b.name)));
    return results.flat();
  },
};
