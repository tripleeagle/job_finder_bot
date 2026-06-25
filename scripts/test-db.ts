import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) { console.error('✗ SUPABASE_URL is missing'); process.exit(1); }
if (!key) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY is missing'); process.exit(1); }

console.log(`✓ env loaded   url=${url.replace(/\.supabase\.co.*/, '.supabase.co')}`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = ['users', 'seen', 'pending_digest'] as const;
let ok = true;

for (const t of tables) {
  const { count, error } = await supabase
    .from(t)
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`✗ table "${t}" — ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ table "${t}" reachable (${count ?? 0} rows)`);
  }
}

if (!ok) {
  console.error('\nSchema check failed. Did you run db/schema.sql in the Supabase SQL editor?');
  process.exit(1);
}

console.log('\nAll good. DB is wired up.');
