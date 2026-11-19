export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const uncertainWrites = new Map<string, string>();

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const writeIdentity = init.method?.toUpperCase() === 'POST' && !headers.has('Idempotency-Key') ? `${url}:${String(init.body || '')}` : null;
  if (writeIdentity) {
    const key = uncertainWrites.get(writeIdentity) || crypto.randomUUID();
    if (uncertainWrites.size >= 100) uncertainWrites.delete(uncertainWrites.keys().next().value!);
    uncertainWrites.set(writeIdentity, key);
    headers.set('Idempotency-Key', key);
  }
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (response.status === 204) return undefined as T;
  let body: any;
  try { body = await response.json(); } catch {
    throw new HttpError(response.status, 'Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
  }
  if (!response.ok) {
    throw new HttpError(response.status, body?.message || body?.issues?.[0]?.message || body?.error || 'Không thể lưu dữ liệu. Hãy thử lại.');
  }
  if (writeIdentity) uncertainWrites.delete(writeIdentity);
  return body as T;
}

export const jsonBody = (value: unknown) => JSON.stringify(value);

export async function allPages<T>(url: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await api<{ data: T[] }>(`${url}${url.includes('?') ? '&' : '?'}limit=500&offset=${offset}`);
    result.push(...page.data);
    if (page.data.length < 500) return result;
  }
}
