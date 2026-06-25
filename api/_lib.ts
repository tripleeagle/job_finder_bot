import type { Cadence, Criteria, EmploymentType } from '../src/shared/types.ts';

export type SubscribePayload = {
  email: string;
  keywords: string[];
  locations: string[];
  employment: EmploymentType[];
  seniority: ('junior' | 'medior' | 'senior')[];
  cadence: Cadence;
};

const EMPLOYMENT_EXCLUDES: Record<EmploymentType, string[]> = {
  'full-time': [],
  'part-time': [],
  contract: [],
  internship: ['internship', 'stáž', 'staz'],
  dpp: ['dpp', 'dpč', 'dpc'],
  dpc: ['dpp', 'dpč', 'dpc'],
};

const SENIORITY_TITLES = ['senior', 'sr.', 'lead', 'head of', 'principal', 'director'];

export function parsePayload(raw: unknown): SubscribePayload {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid body');
  const r = raw as Record<string, unknown>;

  const email = String(r.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');

  const cadence = r.cadence;
  if (cadence !== 'instant' && cadence !== 'daily' && cadence !== 'weekly') {
    throw new Error('Invalid cadence');
  }

  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];

  const keywords = arr(r.keywords);
  if (!keywords.length) throw new Error('At least one keyword is required');

  const employment = arr(r.employment) as EmploymentType[];
  const seniority = arr(r.seniority) as ('junior' | 'medior' | 'senior')[];

  return {
    email,
    keywords,
    locations: arr(r.locations),
    employment,
    seniority,
    cadence,
  };
}

export function toCriteria(p: SubscribePayload): Criteria {
  const allEmployment: EmploymentType[] = [
    'full-time',
    'part-time',
    'contract',
    'internship',
    'dpp',
    'dpc',
  ];
  const unchecked = allEmployment.filter((t) => !p.employment.includes(t));
  const excludeEmployment = Array.from(
    new Set(unchecked.flatMap((t) => EMPLOYMENT_EXCLUDES[t])),
  );

  const excludeSeniority = p.seniority.includes('senior') ? [] : SENIORITY_TITLES;

  return {
    keywords: p.keywords,
    locations: p.locations,
    employmentTypes: p.employment,
    excludeEmployment,
    excludeSeniority,
  };
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
