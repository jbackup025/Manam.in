import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  enforceSameOriginPost,
  getAdminServices,
  isValidSlugServer,
  verifyCaller,
} from '../_lib/firebaseAdmin.js';

const ExportSchema = z.object({
  slug: z.string().min(3).max(40),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!enforceSameOriginPost(req, res)) return;

    const caller = await verifyCaller(req, res);
    if (!caller) return;
    if (!caller.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const parsed = ExportSchema.safeParse(req.body);
    if (!parsed.success || !isValidSlugServer(parsed.data.slug)) {
      return res.status(400).json({ error: 'Invalid export request payload' });
    }

    const { slug } = parsed.data;
    const { db } = getAdminServices();
    const weddingSnap = await db.doc(`weddings/${slug}`).get();
    if (!weddingSnap.exists) {
      return res.status(404).json({ error: 'Wedding not found' });
    }

    const subcollections = [
      'admins',
      'public',
      'assets',
      'rsvps',
      'contributions',
      'blessings',
      'auditLogs',
    ] as const;

    const result: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      slug,
      wedding: weddingSnap.data(),
    };

    for (const sub of subcollections) {
      const snap = await db.collection(`weddings/${slug}/${sub}`).get();
      result[sub] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[api/super/export-wedding] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message === 'SERVICE_ACCOUNT_MISSING' ? 'Server credentials missing' : 'Failed to export wedding' });
  }
}
