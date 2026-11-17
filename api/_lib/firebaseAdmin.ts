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

function resolveServiceAccountCredential() {
  const jsonCandidates: Array<{ name: string; raw: string | undefined }> = [
    { name: 'FIREBASE_SERVICE_ACCOUNT', raw: process.env.FIREBASE_SERVICE_ACCOUNT },
    { name: 'FIREBASE_SERVICE_ACCOUNT_JSON', raw: process.env.FIREBASE_SERVICE_ACCOUNT_JSON },
  ];

  for (const candidate of jsonCandidates) {
    const trimmed = candidate.raw?.trim();
    if (!trimmed) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      console.error(
        `[firebaseAdmin] Invalid ${candidate.name}: value is not valid JSON.`
      );
      throw new Error('SERVICE_ACCOUNT_INVALID');
    }

    const projectId =
      typeof parsed.project_id === 'string' ? parsed.project_id.trim() : '';
    const clientEmail =
      typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
    const privateKey =
      typeof parsed.private_key === 'string'
        ? parsed.private_key.trim().replace(/\\n/g, '\n')
        : '';

    const missingFields: string[] = [];
    if (!projectId) missingFields.push('project_id');
    if (!clientEmail) missingFields.push('client_email');
    if (!privateKey) missingFields.push('private_key');

    if (missingFields.length > 0) {
      console.error(
        `[firebaseAdmin] Invalid ${candidate.name}: missing required JSON field(s): ${missingFields.join(', ')}.`
      );
      throw new Error('SERVICE_ACCOUNT_INVALID');
    }

    return cert({
      ...parsed,
      projectId,
      clientEmail,
      privateKey,
    } as Parameters<typeof cert>[0]);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() || '';
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim() || '';
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : '';

  const missingIndividual: string[] = [];
  if (!projectId) missingIndividual.push('FIREBASE_PROJECT_ID');
  if (!clientEmail) missingIndividual.push('FIREBASE_CLIENT_EMAIL');
  if (!privateKey) missingIndividual.push('FIREBASE_PRIVATE_KEY');

  if (missingIndividual.length === 0) {
    try {
      return cert({
        projectId,
        clientEmail,
        privateKey,
      });
    } catch {
      console.error(
        '[firebaseAdmin] Invalid individual Firebase Admin variables: check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY formatting.'
      );
      throw new Error('SERVICE_ACCOUNT_INVALID');
    }
  }

  if (missingIndividual.length < 3) {
    console.error(
      `[firebaseAdmin] Incomplete Firebase Admin configuration: missing ${missingIndividual.join(', ')}.`
    );
  } else {
    console.error(
      '[firebaseAdmin] Missing Firebase Admin credentials: set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT_JSON), or set all three of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    );
  }
  throw new Error('SERVICE_ACCOUNT_MISSING');
}

export function getAdminServices(): { app: App; db: Firestore; auth: ReturnType<typeof getAuth> } {
  try {
    if (!cachedApp) {
      if (getApps().length > 0) {
        cachedApp = getApps()[0];
      } else {
        const credential = resolveServiceAccountCredential();
        cachedApp = initializeApp({ credential });
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
    const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    if (msg !== 'SERVICE_ACCOUNT_MISSING' && msg !== 'SERVICE_ACCOUNT_INVALID') {
      console.error('[firebaseAdmin] getAdminServices initialization error:', msg);
    }
    throw err;
  }
}

const EXPLICIT_ALLOWED_ORIGINS = new Set<string>([
  'https://manamin.vercel.app',
  'https://manam.in',
  'https://www.manam.in',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function addEnvOrigin(set: Set<string>, raw?: string) {
  if (!raw) return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    set.add(new URL(withScheme).origin.toLowerCase());
  } catch {
    // Ignore malformed optional env URL
  }
}

function getAllowedOrigins(): Set<string> {
  const allowed = new Set(EXPLICIT_ALLOWED_ORIGINS);
  addEnvOrigin(allowed, process.env.APP_URL);
  addEnvOrigin(allowed, process.env.VERCEL_URL);
  addEnvOrigin(allowed, process.env.VERCEL_BRANCH_URL);
  addEnvOrigin(allowed, process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return allowed;
}

function isAllowedOrigin(originHeader: string, req: VercelRequest): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(originHeader);
  } catch {
    return { ok: false, reason: 'Invalid origin URL' };
  }

  const normalizedOrigin = parsed.origin.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const hostHeader = String(req.headers.host || '').trim().toLowerCase();
  const forwardedHostRaw = req.headers['x-forwarded-host'];
  const forwardedHost = (Array.isArray(forwardedHostRaw) ? forwardedHostRaw[0] : forwardedHostRaw || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  if (
    (hostHeader && parsed.host.toLowerCase() === hostHeader) ||
    (forwardedHost && parsed.host.toLowerCase() === forwardedHost)
  ) {
    return { ok: true };
  }

  if (getAllowedOrigins().has(normalizedOrigin)) {
    return { ok: true };
  }

  // Allow AI Studio preview domains (e.g. https://ais-dev-*.run.app, https://ais-pre-*.run.app)
  if (
    parsed.protocol === 'https:' &&
    (/^ais-(dev|pre)-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i.test(hostname) ||
      hostname.endsWith('.aistudio.google.com'))
  ) {
    return { ok: true };
  }

  // Allow local development origins on localhost
  if (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    (hostname === 'localhost' || hostname === '127.0.0.1')
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `Origin ${normalizedOrigin} is not in allowed origins (host=${hostHeader || 'none'}, x-forwarded-host=${forwardedHost || 'none'})`,
  };
}

export function enforceSameOriginPost(req: VercelRequest, res: VercelResponse): boolean {
  const originHeaderRaw = req.headers.origin;
  const originHeader = Array.isArray(originHeaderRaw) ? originHeaderRaw[0] : originHeaderRaw;

  if (originHeader) {
    const check = isAllowedOrigin(originHeader, req);
    if (!check.ok) {
      console.error('[auth/csrf] Bad origin rejected:', {
        origin: originHeader,
        host: req.headers.host,
        forwardedHost: req.headers['x-forwarded-host'],
        reason: check.reason,
      });
      res.status(403).json({ error: 'Cross-origin request rejected: origin not allowed' });
      return false;
    }

    res.setHeader('Access-Control-Allow-Origin', originHeader);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).json({ ok: true });
    return false;
  }

  if (req.method !== 'POST') {
    console.error('[auth/method] Method not allowed:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return false;
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
    const authHeaderRaw = req.headers.authorization;
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
    if (!authHeader) {
      console.error('[auth] Not signed in: missing Authorization header');
      res.status(401).json({ error: 'Not signed in: missing Authorization bearer token' });
      return null;
    }

    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (!match) {
      console.error('[auth] Not signed in: Authorization header is not Bearer format');
      res.status(401).json({ error: 'Not signed in: invalid Authorization bearer header' });
      return null;
    }

    const idToken = match[1].trim();
    if (!idToken) {
      console.error('[auth] Not signed in: empty Authorization bearer token');
      res.status(401).json({ error: 'Not signed in: empty bearer token' });
      return null;
    }

    const { auth } = getAdminServices();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!decoded.email_verified || !decoded.email) {
      console.error('[auth] Forbidden: signed-in token missing verified Google email', {
        uid: decoded.uid,
        hasEmail: Boolean(decoded.email),
        emailVerified: Boolean(decoded.email_verified),
      });
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
    const msg = err instanceof Error ? err.message : '';
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';

    if (msg === 'SERVICE_ACCOUNT_MISSING' || msg === 'SERVICE_ACCOUNT_INVALID') {
      console.error('[auth] Server Firebase Admin credentials error:', msg);
      res.status(503).json({ error: 'Server Firebase Admin credentials are not configured' });
      return null;
    }

    if (code === 'auth/id-token-expired') {
      console.error('[auth] Expired Firebase ID token:', code);
      res.status(401).json({ error: 'Authentication token expired. Please sign in again.' });
      return null;
    }

    if (code === 'auth/id-token-revoked') {
      console.error('[auth] Revoked Firebase ID token:', code);
      res.status(401).json({ error: 'Authentication session was revoked. Please sign in again.' });
      return null;
    }

    console.error('[auth] Token verification failed:', { code, message: msg, err });
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
