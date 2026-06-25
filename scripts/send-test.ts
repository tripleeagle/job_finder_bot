import { Resend } from 'resend';

const key = process.env.RESEND_API_KEY!;
const to = process.argv[2];
const from = process.argv[3] ?? 'onboarding@resend.dev';

if (!to) { console.error('usage: send-test.ts <to> [from]'); process.exit(1); }

const r = new Resend(key);
const { data, error } = await r.emails.send({
  from,
  to,
  subject: 'jobsignal — test from local dev',
  html: '<p style="font-family:system-ui">If you see this, Resend is wired up correctly. ◊</p>',
});

if (error) { console.error('✗ send failed:', error); process.exit(1); }
console.log(`✓ sent   id=${data?.id}   from=${from}   to=${to}`);
