import { unsubscribeByToken } from '../src/shared/db.ts';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  // Idempotent: a second click returns false (no active row matched) but we
  // still send the user to the "you're unsubscribed" page rather than an error.
  try {
    await unsubscribeByToken(token);
  } catch (e) {
    console.error('unsubscribe failed:', e);
    return new Response('Could not unsubscribe right now', { status: 500 });
  }

  return Response.redirect(`${url.origin}/unsubscribed.html`, 302);
}
