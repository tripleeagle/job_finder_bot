import { jobsCz } from '../shared/sources/jobs-cz.ts';
import { startupJobsCz } from '../shared/sources/startupjobs-cz.ts';
import { praceCz } from '../shared/sources/prace-cz.ts';
import { cocumaCz } from '../shared/sources/cocuma-cz.ts';
import { noFluffJobs } from '../shared/sources/nofluffjobs.ts';
import { dobraPraceCz } from '../shared/sources/dobraprace-cz.ts';
import { greenhouse } from '../shared/sources/greenhouse.ts';
import { lever } from '../shared/sources/lever.ts';
import { indeedCz } from '../shared/sources/indeed-cz.ts';
import { profesiaCz } from '../shared/sources/profesia-cz.ts';
import { dedupKey, matches } from '../shared/filter.ts';
import type { Job, Source } from '../shared/sources/types.ts';
import type { Cadence, User } from '../shared/types.ts';
import {
  clearPendingDigest,
  getActiveUsers,
  getLastDigestAt,
  getSeenIds,
  markDigestSent,
  markSeen,
  queueDigest,
  takePendingDigest,
} from '../shared/db.ts';
import { sendMatches } from '../shared/email.ts';

const SOURCES: Source[] = [
  jobsCz,
  praceCz,
  startupJobsCz,
  cocumaCz,
  greenhouse,
  lever,
  noFluffJobs,
  profesiaCz,
  indeedCz,
  dobraPraceCz,
];

const DRY_RUN = process.env.DRY_RUN === '1';

async function fetchAllJobs(): Promise<Job[]> {
  const all: Job[] = [];
  for (const src of SOURCES) {
    try {
      const jobs = await src.fetch();
      all.push(...jobs);
    } catch (e) {
      console.error(`[${src.name}] failed:`, (e as Error).message);
    }
  }
  return all;
}

// Daily digests go out once every 20+ hours; weekly once every 6+ days.
// The min wait is loose on purpose so cron jitter doesn't skip a day.
function isDigestDue(cadence: Cadence, lastSent: Date | null): boolean {
  if (!lastSent) return true;
  const ageHours = (Date.now() - lastSent.getTime()) / 3_600_000;
  if (cadence === 'daily') return ageHours >= 20;
  if (cadence === 'weekly') return ageHours >= 144;
  return false;
}

async function processUser(user: User, jobs: Job[]): Promise<void> {
  const seen = await getSeenIds(user.id);
  const fresh: Job[] = [];
  const seenKeys = new Set<string>();

  for (const job of jobs) {
    if (!matches(job, user.criteria)) continue;
    if (seen.has(job.id)) continue;
    const key = dedupKey(job);
    const keyId = `key:${key}`;
    if (key !== '|' && (seen.has(keyId) || seenKeys.has(keyId))) continue;
    fresh.push(job);
    seenKeys.add(keyId);
  }

  if (!fresh.length && user.cadence === 'instant') return;

  const seenIdsToMark = fresh.flatMap((j) => {
    const key = dedupKey(j);
    return key === '|' ? [j.id] : [j.id, `key:${key}`];
  });

  if (user.cadence === 'instant') {
    if (DRY_RUN) {
      console.log(`[${user.email}] would send ${fresh.length} matches`);
      return;
    }
    await sendMatches(user.email, user.unsubscribe_token, fresh);
    await markSeen(user.id, seenIdsToMark);
    return;
  }

  // Digest path: queue new matches, then flush if due.
  if (fresh.length) {
    if (!DRY_RUN) {
      await queueDigest(user.id, fresh);
      await markSeen(user.id, seenIdsToMark);
    } else {
      console.log(`[${user.email}] would queue ${fresh.length} matches (${user.cadence})`);
    }
  }

  const lastSent = await getLastDigestAt(user.id);
  if (!isDigestDue(user.cadence, lastSent)) return;

  const queued = await takePendingDigest(user.id);
  if (!queued.length) return;

  if (DRY_RUN) {
    console.log(`[${user.email}] digest due, would flush ${queued.length} jobs`);
    return;
  }
  await sendMatches(user.email, user.unsubscribe_token, queued);
  await clearPendingDigest(user.id);
  await markDigestSent(user.id);
}

async function run(): Promise<void> {
  const users = await getActiveUsers();
  console.log(`Active users: ${users.length}`);
  if (!users.length) return;

  const jobs = await fetchAllJobs();
  console.log(`Fetched ${jobs.length} jobs across ${SOURCES.length} sources`);

  for (const user of users) {
    try {
      await processUser(user, jobs);
    } catch (e) {
      console.error(`User ${user.email} failed:`, (e as Error).message);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
