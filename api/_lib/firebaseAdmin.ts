import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL || 'jbackup025@gmail.com'
).trim().toLowerCase();

export const RESERVED_SLUGS = new Set([
  'admin',
  'super',
  'wedding',
  'api',
  'privacy',
  'terms',
]);

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

function resolveDatabaseId(): string | undefined {
  const envDbId = process.env.FIREBASE_DATABASE_ID?.trim();
  if (envDbId && envDbId !== '(default)') {
    return envDbId;
  }
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (parsed?.firestoreDatabaseId && parsed.firestoreDatabaseId !== '(default)') {
        return String(parsed.firestoreDatabaseId);
      }
    }
  } catch {
    // Ignore optional local config fallback errors
  }
  return undefined;
}

export function getAdminServices(): { app: App; db: Firestore; auth: ReturnType<typeof getAuth> } {
  try {
    if (!cachedApp) {
      if (getApps().length > 0) {
        cachedApp = getApps()[0];
      } else {
        const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!rawJson) {
          throw new Error('SERVICE_ACCOUNT_MISSING');
        }
        let serviceAccount: Record<string, unknown>;
        try {
          serviceAccount = JSON.parse(rawJson);
        } catch (parseErr) {
          console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr);
          throw new Error('SERVICE_ACCOUNT_INVALID');
        }
        cachedApp = initializeApp({
          credential: cert(serviceAccount as Parameters<typeof cert>[0]),
        });
      }
    }

    if (!cachedDb) {
      const dbId = resolveDatabaseId();
      cachedDb = dbId ? getFirestore(cachedApp, dbId) : getFirestore(cachedApp);
    }

    return {
      app: cachedApp,
      db: cachedDb,
      auth: getAuth(cachedApp),
    };
  } catch (err) {
    console.error('[firebaseAdmin] getAdminServices error:', err);
    throw err;
  }
}

export function enforceSameOriginPost(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }

  const hostHeader = req.headers.host;
  const originHeader = req.headers.origin;
  if (originHeader && hostHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== hostHeader) {
        res.status(403).json({ error: 'Cross-origin request rejected' });
        return false;
      }
    } catch {
      res.status(403).json({ error: 'Invalid origin header' });
      return false;
    }
  }

  return true;
}

export interface VerifiedCaller {
  uid: string;
  email: string;
  isSuperAdmin: boolean;
}

export async function verifyCaller(
  req: VercelRequest,
  res: VercelResponse
): Promise<VerifiedCaller | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Authorization bearer token' });
      return null;
    }

    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken) {
      res.status(401).json({ error: 'Empty bearer token' });
      return null;
    }

    const { auth } = getAdminServices();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!decoded.email_verified || !decoded.email) {
      res.status(403).json({ error: 'Verified Google email required' });
      return null;
    }
    const email = decoded.email.trim().toLowerCase();
    return {
      uid: decoded.uid,
      email,
      isSuperAdmin: email === SUPER_ADMIN_EMAIL,
    };
  } catch (err) {
    console.error('[auth] verifyCaller failed:', err);
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'SERVICE_ACCOUNT_MISSING' || msg === 'SERVICE_ACCOUNT_INVALID') {
      res.status(503).json({ error: 'Server Firebase Admin credentials are not configured' });
      return null;
    }
    res.status(401).json({ error: 'Invalid or expired authentication token' });
    return null;
  }
}

export async function requireWeddingAccess(
  db: Firestore,
  slug: string,
  caller: VerifiedCaller
): Promise<boolean> {
  if (!SLUG_REGEX.test(slug) || RESERVED_SLUGS.has(slug)) {
    return false;
  }
  if (caller.isSuperAdmin) {
    return true;
  }
  try {
    const adminSnap = await db.doc(`weddings/${slug}/admins/${caller.email}`).get();
    return adminSnap.exists;
  } catch (err) {
    console.error('[auth] requireWeddingAccess failed:', err);
    throw err;
  }
}

export function isValidSlugServer(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !RESERVED_SLUGS.has(slug);
}
