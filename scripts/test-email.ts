import { Resend } from 'resend';

const key = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const site = process.env.SITE_URL;

if (!key)  { console.error('✗ RESEND_API_KEY is missing'); process.exit(1); }
if (!from) { console.error('✗ EMAIL_FROM is missing');     process.exit(1); }
if (!site) { console.error('✗ SITE_URL is missing');       process.exit(1); }

console.log(`✓ env loaded   from=${from}   site=${site}`);

// Heads-up on placeholders still in .env
if (from.includes('yourdomain') || from.includes('example')) {
  console.log(`⚠ EMAIL_FROM looks like a placeholder: ${from}`);
  console.log('  Replace with a real address on a domain you verified in Resend.');
}
if (site.includes('your-site') || site === 'http://localhost:3000') {
  console.log(`⚠ SITE_URL looks like a placeholder: ${site}`);
  console.log('  Will be wrong in verification + unsubscribe email links until set.');
}

const resend = new Resend(key);

const { data, error } = await resend.domains.list();
if (error) {
  if (/restricted/i.test(error.message)) {
    console.log('✓ Resend key valid (restricted to sending — can\'t list domains, that\'s fine)');
  } else if (/invalid|unauthorized|api key/i.test(error.message)) {
    console.error(`✗ Resend key rejected: ${error.message}`);
    process.exit(1);
  } else {
    console.error(`✗ Unexpected Resend error: ${error.message}`);
    process.exit(1);
  }
} else {
  const domains = data?.data ?? [];
  console.log(`✓ Resend key valid   ${domains.length} domain(s) on account`);
  for (const d of domains) {
    const flag = d.status === 'verified' ? '✓' : '·';
    console.log(`  ${flag} ${d.name}   status=${d.status}   region=${d.region}`);
  }
  if (!domains.some((d) => d.status === 'verified')) {
    console.log('\n⚠ No verified domain. You can still send from onboarding@resend.dev,');
    console.log('  but real sending needs a verified domain in EMAIL_FROM.');
  }
}

// Optional: send a real test email if user passed --to=<addr>
const toArg = process.argv.find((a) => a.startsWith('--to='))?.slice(5);
if (toArg) {
  const { data: sent, error: sendErr } = await resend.emails.send({
    from,
    to: toArg,
    subject: 'jobsignal — Resend test',
    html: '<p>If you see this, Resend is wired up correctly.</p>',
  });
  if (sendErr) {
    console.error(`\n✗ Test send failed: ${sendErr.message}`);
    process.exit(1);
  }
  console.log(`\n✓ Test email queued   id=${sent?.id}   to=${toArg}`);
}

console.log('\nAll good. Resend is wired up.');
