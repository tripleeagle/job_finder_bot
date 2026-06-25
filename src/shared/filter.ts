import type { Job } from './sources/types.ts';
import type { Criteria } from './types.ts';

const norm = (s: string) => s.toLowerCase().normalize('NFKD');

export function dedupKey(job: Job): string {
  const flatten = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\bm\s*\/\s*[zž]\b/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return `${flatten(job.company)}|${flatten(job.title)}`;
}

export function matches(job: Job, c: Criteria): boolean {
  const hay = norm(`${job.title} ${job.description} ${job.location} ${job.employmentType ?? ''}`);
  const title = norm(job.title);

  if (c.keywords.length && !c.keywords.some((k) => hay.includes(norm(k)))) return false;
  if (c.locations.length && !c.locations.some((l) => hay.includes(norm(l)))) return false;
  if (c.excludeEmployment.some((e) => hay.includes(norm(e)))) return false;
  if (c.excludeSeniority.some((t) => title.includes(norm(t)))) return false;
  return true;
}
