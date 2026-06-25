-- Run this in the Supabase SQL editor once.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  criteria jsonb not null,
  cadence text not null check (cadence in ('instant', 'daily', 'weekly')),
  verify_token text,
  verified_at timestamptz,
  unsubscribe_token text not null,
  last_digest_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists users_verified_active_idx
  on users (verified_at)
  where verified_at is not null and unsubscribed_at is null;

create unique index if not exists users_unsubscribe_token_idx
  on users (unsubscribe_token);

-- One row per (user, job) we've already sent or queued. Cross-source dedup is
-- handled by storing fuzzy keys here too (with a "key:" prefix).
create table if not exists seen (
  user_id uuid not null references users (id) on delete cascade,
  job_id text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists seen_sent_at_idx on seen (sent_at);

-- Matches queued for daily/weekly users, flushed when their cadence is due.
create table if not exists pending_digest (
  user_id uuid not null references users (id) on delete cascade,
  job_id text not null,
  job jsonb not null,
  queued_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists pending_digest_user_idx on pending_digest (user_id);
