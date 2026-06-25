import type { Job, Source } from './types.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const BOARDS = [
  { slug: 'keboola', name: 'Keboola' },
  { slug: 'pipedrive', name: 'Pipedrive' },
];

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  workplaceType?: string;
  categories?: {
    commitment?: string;
    location?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  descriptionPlain?: string;
};

const PRAGUE_RE = /\b(pra(g|h)|prague|praha|czech|česko|česk[áé]\s*republik)/i;
const REMOTE_RE = /\b(remote|anywhere|emea|europe|eu only|wfh)\b/i;

async function fetchBoard(slug: string, displayName: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`lever:${slug}: HTTP ${res.status}`);
    return [];
  }
  const postings = (await res.json()) as LeverPosting[];
  const out: Job[] = [];

  for (const p of postings) {
    const cats = p.categories ?? {};
    const locStr = [cats.location, ...(cats.allLocations ?? [])].filter(Boolean).join(' | ');
    const isPrague = PRAGUE_RE.test(locStr);
    const isRemoteEu = REMOTE_RE.test(locStr) || p.workplaceType === 'remote';
    if (!isPrague && !isRemoteEu) continue;

    out.push({
      id: `lever:${slug}:${p.id}`,
      source: `lever/${displayName}`,
      title: p.text,
      company: displayName,
      location: locStr || (isRemoteEu ? 'Remote' : ''),
      url: p.hostedUrl,
      description: [p.text, cats.team, cats.department, locStr, p.descriptionPlain?.slice(0, 300)]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 600),
      employmentType: cats.commitment,
    });
  }
  return out;
}

export const lever: Source = {
  name: 'lever',
  fetch: async () => {
    const results = await Promise.all(BOARDS.map((b) => fetchBoard(b.slug, b.name)));
    return results.flat();
  },
};
