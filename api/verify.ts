import { verifyUser } from '../src/shared/db.ts';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  const ok = await verifyUser(token);
  if (!ok) return new Response('Invalid or expired token', { status: 400 });

  return Response.redirect(`${url.origin}/verified.html`, 302);
}
