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

const ConfirmSchema = z.object({
  slug: z.string().min(3).max(40),
  contributionId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!enforceSameOriginPost(req, res)) return;

  const caller = await verifyCaller(req, res);
  if (!caller) return;

  const parsed = ConfirmSchema.safeParse(req.body);
  if (!parsed.success || !isValidSlugServer(parsed.data.slug)) {
    return res.status(400).json({ error: 'Invalid contribution request payload' });
  }

  const { slug, contributionId } = parsed.data;

  try {
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
        return { kind: 'not_found' as const };
      }

      const contrib = contribSnap.data()!;
      if (contrib.status === 'confirmed') {
        return { kind: 'already_confirmed' as const };
      }
      if (contrib.status !== 'pending') {
        return { kind: 'invalid_state' as const, status: String(contrib.status) };
      }

      const amountPaise = Number(contrib.amountPaise) || 0;
      const recipient = contrib.recipient === 'partner2' ? 'partner2' : 'partner1';

      const progressSnap = await tx.get(progressRef);
      const current = progressSnap.exists
        ? progressSnap.data()!
        : {
            confirmedTotalPaise: 0,
            partner1TotalPaise: 0,
            partner2TotalPaise: 0,
            confirmedCount: 0,
          };

      const nextTotal = (Number(current.confirmedTotalPaise) || 0) + amountPaise;
      const nextP1 =
        (Number(current.partner1TotalPaise) || 0) + (recipient === 'partner1' ? amountPaise : 0);
      const nextP2 =
        (Number(current.partner2TotalPaise) || 0) + (recipient === 'partner2' ? amountPaise : 0);
      const nextCount = (Number(current.confirmedCount) || 0) + 1;

      tx.update(contribRef, {
        status: 'confirmed',
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(progressRef, {
        confirmedTotalPaise: nextTotal,
        partner1TotalPaise: nextP1,
        partner2TotalPaise: nextP2,
        confirmedCount: nextCount,
        updatedAt: FieldValue.serverTimestamp(),
      });

      const messageText = typeof contrib.message === 'string' ? contrib.message.trim() : '';
      if (messageText.length > 0) {
        const displayName =
          contrib.showName && typeof contrib.donorName === 'string' && contrib.donorName.trim()
            ? contrib.donorName.trim().slice(0, 80)
            : 'A loved one';
        tx.set(blessingRef, {
          displayName,
          message: messageText.slice(0, 500),
          approved: false,
          source: 'contribution',
          sourceId: contributionId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(auditRef, {
        actorEmail: caller.email,
        action: 'CONTRIBUTION_CONFIRMED',
        targetId: contributionId,
        timestamp: FieldValue.serverTimestamp(),
      });

      return { kind: 'confirmed' as const };
    });

    if (outcome.kind === 'not_found') {
      return res.status(404).json({ error: 'Contribution not found' });
    }
    if (outcome.kind === 'invalid_state') {
      return res.status(409).json({ error: `Cannot confirm contribution in status ${outcome.status}` });
    }
    if (outcome.kind === 'already_confirmed') {
      return res.status(200).json({ ok: true, alreadyConfirmed: true });
    }

    return res.status(200).json({ ok: true, alreadyConfirmed: false });
  } catch (err) {
    console.error('Confirm contribution error');
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message === 'SERVICE_ACCOUNT_MISSING' ? 'Server credentials missing' : 'Failed to confirm contribution' });
  }
}
