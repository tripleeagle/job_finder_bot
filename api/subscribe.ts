import { createPendingUser } from '../src/shared/db.ts';
import { sendVerify } from '../src/shared/email.ts';
import { json, parsePayload, toCriteria } from './_lib.ts';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let payload;
  try {
    payload = parsePayload(await req.json());
  } catch (e) {
    return json(400, { error: (e as Error).message });
  }

  try {
    const { verifyToken, unsubscribeToken } = await createPendingUser({
      email: payload.email,
      criteria: toCriteria(payload),
      cadence: payload.cadence,
    });
    await sendVerify(payload.email, verifyToken, unsubscribeToken);
  } catch (e) {
    console.error('subscribe failed:', e);
    return json(500, { error: 'Could not subscribe right now' });
  }

  return json(200, { ok: true });
}
