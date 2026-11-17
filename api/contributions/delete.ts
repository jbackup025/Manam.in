import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  enforceSameOriginPost,
  getAdminServices,
  isValidSlugServer,
  requireWeddingAccess,
  verifyCaller,
} from '../_lib/firebaseAdmin.js';

const DeleteSchema = z.object({
  slug: z.string().min(3).max(40),
  contributionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!enforceSameOriginPost(req, res)) return;

    const caller = await verifyCaller(req, res);
    if (!caller) return;

    const parsed = DeleteSchema.safeParse(req.body);
    if (!parsed.success || !isValidSlugServer(parsed.data.slug)) {
      return res.status(400).json({ error: 'Invalid contribution request payload' });
    }

    const { slug, contributionId } = parsed.data;
    const { db } = getAdminServices();
    const hasAccess = await requireWeddingAccess(db, slug, caller);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const contribRef = db.doc(`weddings/${slug}/contributions/${contributionId}`);
    const progressRef = db.doc(`weddings/${slug}/public/progress`);
    const blessingRef = db.doc(`weddings/${slug}/blessings/${contributionId}`);
    const auditRef = db.collection(`weddings/${slug}/auditLogs`).doc();

    const outcome = await db.runTransaction(async (tx) => {
      const contribSnap = await tx.get(contribRef);
      if (!contribSnap.exists) {
        return { kind: 'already_deleted' as const };
      }

      const contrib = contribSnap.data()!;
      const progressSnap = await tx.get(progressRef);
      const blessingSnap = await tx.get(blessingRef);

      if (contrib.status === 'confirmed' && progressSnap.exists) {
        const amountPaise = Number(contrib.amountPaise) || 0;
        const recipient = contrib.recipient === 'partner2' ? 'partner2' : 'partner1';
        const current = progressSnap.data()!;
        tx.set(progressRef, {
          confirmedTotalPaise: Math.max(0, (Number(current.confirmedTotalPaise) || 0) - amountPaise),
          partner1TotalPaise: Math.max(
            0,
            (Number(current.partner1TotalPaise) || 0) - (recipient === 'partner1' ? amountPaise : 0)
          ),
          partner2TotalPaise: Math.max(
            0,
            (Number(current.partner2TotalPaise) || 0) - (recipient === 'partner2' ? amountPaise : 0)
          ),
          confirmedCount: Math.max(0, (Number(current.confirmedCount) || 0) - 1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.delete(contribRef);
      if (blessingSnap.exists) {
        tx.delete(blessingRef);
      }

      tx.set(auditRef, {
        actorEmail: caller.email,
        action: 'CONTRIBUTION_DELETED',
        targetId: contributionId,
        timestamp: FieldValue.serverTimestamp(),
      });

      return { kind: 'deleted' as const };
    });

    return res.status(200).json({ ok: true, alreadyDeleted: outcome.kind === 'already_deleted' });
  } catch (err) {
    console.error('[api/contributions/delete] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message === 'SERVICE_ACCOUNT_MISSING' ? 'Server credentials missing' : 'Failed to delete contribution' });
  }
}
