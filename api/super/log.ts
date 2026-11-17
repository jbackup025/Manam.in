import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  enforceSameOriginPost,
  getAdminServices,
  isValidSlugServer,
  verifyCaller,
} from '../_lib/firebaseAdmin.js';

const LogSchema = z.object({
  action: z.enum([
    'WEDDING_CREATED',
    'WEDDING_STATUS_CHANGED',
    'WEDDING_EXPIRY_UPDATED',
    'WEDDING_ADMIN_UPDATED',
  ]),
  targetSlug: z.string().min(3).max(40),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!enforceSameOriginPost(req, res)) return;

    const caller = await verifyCaller(req, res);
    if (!caller) return;
    if (!caller.isSuperAdmin) {
      console.error('[api/super/log] Forbidden: caller is not super admin', {
        uid: caller.uid,
        callerEmail: caller.email,
      });
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const parsed = LogSchema.safeParse(req.body);
    if (!parsed.success || !isValidSlugServer(parsed.data.targetSlug)) {
      return res.status(400).json({ error: 'Invalid audit log payload' });
    }

    const { db } = getAdminServices();
    await db.collection('platformAuditLog').add({
      actorEmail: caller.email,
      action: parsed.data.action,
      targetSlug: parsed.data.targetSlug,
      timestamp: FieldValue.serverTimestamp(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/super/log] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message === 'SERVICE_ACCOUNT_MISSING' ? 'Server credentials missing' : 'Failed to record platform audit log' });
  }
}
