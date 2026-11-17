import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminServices } from '../_lib/firebaseAdmin.js';

function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || !authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const provided = authHeader.slice('Bearer '.length).trim();
  if (!safeEqual(provided, secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { db } = getAdminServices();
    const todayIST = getTodayIST();

    let completedCount = 0;
    let flaggedCount = 0;

    // 1. Mark ACTIVE weddings as COMPLETED the day after weddingDate
    const activeSnap = await db.collection('weddings').where('status', '==', 'ACTIVE').get();
    for (const docSnap of activeSnap.docs) {
      const data = docSnap.data();
      const weddingDate = typeof data.weddingDate === 'string' ? data.weddingDate : '';
      const graceDays = Number(data.graceDays) || 30;
      if (weddingDate && weddingDate < todayIST) {
        const eraseEligibleDate = addDaysToYmd(weddingDate, graceDays);
        const isReadyForErase = eraseEligibleDate <= todayIST;
        await docSnap.ref.update({
          status: 'COMPLETED',
          readyForErase: isReadyForErase,
          updatedAt: FieldValue.serverTimestamp(),
        });
        completedCount += 1;
        if (isReadyForErase) flaggedCount += 1;
      }
    }

    // 2. Flag COMPLETED weddings as Ready for erase after graceDays (never auto-erase)
    const completedSnap = await db.collection('weddings').where('status', '==', 'COMPLETED').get();
    for (const docSnap of completedSnap.docs) {
      const data = docSnap.data();
      if (data.readyForErase === true) continue;
      const weddingDate = typeof data.weddingDate === 'string' ? data.weddingDate : '';
      const graceDays = Number(data.graceDays) || 30;
      if (weddingDate) {
        const eraseEligibleDate = addDaysToYmd(weddingDate, graceDays);
        if (eraseEligibleDate <= todayIST) {
          await docSnap.ref.update({
            readyForErase: true,
            updatedAt: FieldValue.serverTimestamp(),
          });
          flaggedCount += 1;
        }
      }
    }

    if (completedCount > 0 || flaggedCount > 0) {
      await db.collection('platformAuditLog').add({
        actorEmail: 'system-cron',
        action: `DAILY_CRON_COMPLETED_${completedCount}_FLAGGED_${flaggedCount}`,
        targetSlug: 'platform',
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    return res.status(200).json({
      ok: true,
      todayIST,
      markedCompleted: completedCount,
      flaggedReadyForErase: flaggedCount,
    });
  } catch (err) {
    console.error('Daily cron error');
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message === 'SERVICE_ACCOUNT_MISSING' ? 'Server credentials missing' : 'Cron run failed' });
  }
}
