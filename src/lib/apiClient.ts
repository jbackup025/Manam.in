import { auth } from './firebase';

export async function callAuthedApi<TResponse = Record<string, unknown>>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<TResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to perform this action.');
  }
  const token = await user.getIdToken();

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
    data = { error: text || `Request failed (${res.status})` };
  }

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : `Server request failed (${res.status})`
    );
  }

  return data as TResponse;
}
