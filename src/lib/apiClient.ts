import { auth } from './firebase';

export interface CallAuthedApiOptions {
  forceRefreshToken?: boolean;
}

function formatFallbackError(status: number, rawText: string): string {
  const trimmed = rawText.trim();
  const looksLikeHtml =
    trimmed.startsWith('<') ||
    /<html[\s>]/i.test(trimmed) ||
    /<!doctype\s+html/i.test(trimmed);

  if (looksLikeHtml || !trimmed) {
    if (status === 401) {
      return 'Your sign-in session is missing or expired. Please sign out and sign in again.';
    }
    if (status === 403) {
      return 'Access forbidden (HTTP 403). Verify you are signed in with the Super Admin Google account and the request origin is allowed.';
    }
    if (status === 404) {
      return 'API endpoint not found (HTTP 404).';
    }
    return `Server returned an unexpected HTTP ${status} response. Check server runtime logs for details.`;
  }

  return trimmed;
}

export async function callAuthedApi<TResponse = Record<string, unknown>>(
  endpoint: string,
  payload: Record<string, unknown>,
  options?: CallAuthedApiOptions
): Promise<TResponse> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await user.getIdToken(Boolean(options?.forceRefreshToken));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: formatFallbackError(res.status, text) };
  }

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : formatFallbackError(res.status, text)
    );
  }

  return data as TResponse;
}
