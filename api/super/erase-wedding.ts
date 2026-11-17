import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  enforceSameOriginPost,
  getAdminServices,
  isValidSlugServer,
  verifyCaller,
} from '../_lib/firebaseAdmin.js';

const SUBCOLLECTIONS = [
  'rsvps',
  'contributions',
  'blessings',
  'assets',
  'auditLogs',
  'admins',
  'public',
] as const;

const EraseSchema = z.object({
  slug: z.string().min(3).max(40),
  confirmSlug: z.string().min(3).max(40),
});

async function deleteCollectionInBatches(db: Firestore, path: string): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(path).limit(350).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!enforceSameOriginPost(req, res)) return;

    const caller = await verifyCaller(req, res);
    if (!caller) return;
    if (!caller.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const parsed = EraseSchema.safeParse(req.body);
    if (!parsed.success || !isValidSlugServer(parsed.data.slug)) {
      return res.status(400).json({ error: 'Invalid erase request payload' });
    }

    const { slug, confirmSlug } = parsed.data;
    if (slug !== confirmSlug) {
      return res.status(400).json({ error: 'Confirmation slug does not match' });
    }
    const { db } = getAdminServices();
    const weddingRef = db.doc(`weddings/${slug}`);
    const weddingSnap = await weddingRef.get();

    if (weddingSnap.exists) {
      await weddingRef.update({
        status: 'DELETION_PENDING',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    let deletedDocs = 0;
    for (const sub of SUBCOLLECTIONS) {
      deletedDocs += await deleteCollectionInBatches(db, `weddings/${slug}/${sub}`);
    }

    if (weddingSnap.exists) {
      await weddingRef.delete();
      deletedDocs += 1;
    }

    // Verify zero documents remain
    const remaining: Record<string, number> = {};
    let totalRemaining = 0;

    for (const sub of SUBCOLLECTIONS) {
      const countSnap = await db.collection(`weddings/${slug}/${sub}`).count().get();
      const count = countSnap.data().count;
      if (count > 0) {
        remaining[sub] = count;
        totalRemaining += count;
      }
    }

    const parentCheck = await weddingRef.get();
    if (parentCheck.exists) {
      remaining.parent = 1;
      totalRemaining += 1;
    }

    if (totalRemaining > 0) {
      return res.status(500).json({
        ok: false,
        error: 'Incomplete erasure; safe to re-run',
        remaining,
      });
    }

    // Write tombstone and non-personal platform audit log
    await db.doc(`reservedSlugs/${slug}`).set(
      {
        erasedAt: FieldValue.serverTimestamp(),
        reason: 'erased',
      },
      { merge: true }
    );

    await db.collection('platformAuditLog').add({
      actorEmail: caller.email,
      action: 'WEDDING_ERASED',
      targetSlug: slug,
      timestamp: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      deletedDocs,
      remainingCount: 0,
      slugReserved: true,
    });
  } catch (err) {
    console.error('[api/super/erase-wedding] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message === 'SERVICE_ACCOUNT_MISSING' ? 'Server credentials missing' : 'Failed to erase wedding' });
  }
}
