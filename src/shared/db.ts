import { createClient } from '@supabase/supabase-js';
import type { Job } from './sources/types.ts';
import type { Cadence, Criteria, User } from './types.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const newToken = () => crypto.randomUUID().replace(/-/g, '');

export async function getActiveUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, criteria, cadence, verified_at, unsubscribe_token')
    .not('verified_at', 'is', null)
    .is('unsubscribed_at', null);
  if (error) throw error;
  return (data ?? []) as User[];
}

export type CreateResult = { verifyToken: string; unsubscribeToken: string };

export async function createPendingUser(input: {
  email: string;
  criteria: Criteria;
  cadence: Cadence;
}): Promise<CreateResult> {
  // Preserve existing unsubscribe_token across re-subscribes so links in
  // previously-sent emails keep working.
  const { data: existing, error: selErr } = await supabase
    .from('users')
    .select('unsubscribe_token')
    .eq('email', input.email)
    .maybeSingle();
  if (selErr) throw selErr;

  const verifyToken = newToken();
  const unsubscribeToken = existing?.unsubscribe_token ?? newToken();

  const { error } = await supabase.from('users').upsert(
    {
      email: input.email,
      criteria: input.criteria,
      cadence: input.cadence,
      verify_token: verifyToken,
      unsubscribe_token: unsubscribeToken,
      verified_at: null,
      unsubscribed_at: null,
    },
    { onConflict: 'email' },
  );
  if (error) throw error;

  return { verifyToken, unsubscribeToken };
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .is('unsubscribed_at', null)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function verifyUser(token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .update({ verified_at: new Date().toISOString(), verify_token: null })
    .eq('verify_token', token)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function getSeenIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('seen')
    .select('job_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.job_id as string));
}

export async function markSeen(userId: string, jobIds: string[]): Promise<void> {
  if (!jobIds.length) return;
  const rows = jobIds.map((job_id) => ({ user_id: userId, job_id }));
  const { error } = await supabase.from('seen').upsert(rows, {
    onConflict: 'user_id,job_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function queueDigest(userId: string, jobs: Job[]): Promise<void> {
  if (!jobs.length) return;
  const rows = jobs.map((j) => ({ user_id: userId, job_id: j.id, job: j }));
  const { error } = await supabase.from('pending_digest').upsert(rows, {
    onConflict: 'user_id,job_id',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function takePendingDigest(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('pending_digest')
    .select('job')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.job as Job);
}

export async function clearPendingDigest(userId: string): Promise<void> {
  const { error } = await supabase.from('pending_digest').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function markDigestSent(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ last_digest_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function getLastDigestAt(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from('users')
    .select('last_digest_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data?.last_digest_at ? new Date(data.last_digest_at) : null;
}
