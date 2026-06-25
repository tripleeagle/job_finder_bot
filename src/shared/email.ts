import { Resend } from 'resend';
import type { Job } from './sources/types.ts';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'JobFinder <jobs@example.com>';
const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

if (!apiKey) throw new Error('Missing RESEND_API_KEY');

const resend = new Resend(apiKey);

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]!,
  );

function jobCard(job: Job): string {
  const meta = [job.company, job.location, job.employmentType]
    .filter((v): v is string => Boolean(v))
    .map(esc)
    .join(' · ');
  return `
    <div style="margin:0 0 20px;padding:14px;border:1px solid #e5e7eb;border-radius:8px">
      <a href="${esc(job.url)}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${esc(job.title)}</a>
      <div style="color:#555;font-size:13px;margin-top:4px">${meta}</div>
      <div style="color:#888;font-size:12px;margin-top:6px">${esc(job.source)}</div>
    </div>`;
}

function shell(inner: string, unsubscribeToken: string): string {
  const unsub = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
${inner}
<hr style="margin:24px 0;border:none;border-top:1px solid #eee">
<div style="font-size:12px;color:#888">
  You're receiving this because you subscribed at ${esc(siteUrl)}.
  <a href="${esc(unsub)}" style="color:#888">Unsubscribe</a>.
</div>
</body></html>`;
}

export async function sendVerify(
  email: string,
  verifyToken: string,
  unsubscribeToken: string,
): Promise<void> {
  const link = `${siteUrl}/api/verify?token=${encodeURIComponent(verifyToken)}`;
  const html = shell(
    `<h2 style="margin:0 0 12px">Confirm your subscription</h2>
     <p>Click below to confirm and start receiving job matches.</p>
     <p><a href="${esc(link)}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Confirm subscription</a></p>
     <p style="color:#666;font-size:13px">If you didn't sign up, ignore this email.</p>`,
    unsubscribeToken,
  );
  await resend.emails.send({ from, to: email, subject: 'Confirm your job alerts', html });
}

export async function sendMatches(
  email: string,
  unsubscribeToken: string,
  jobs: Job[],
): Promise<void> {
  if (!jobs.length) return;
  const heading = jobs.length === 1 ? '1 new job match' : `${jobs.length} new job matches`;
  const html = shell(
    `<h2 style="margin:0 0 16px">${heading}</h2>${jobs.map(jobCard).join('')}`,
    unsubscribeToken,
  );
  await resend.emails.send({ from, to: email, subject: heading, html });
}
