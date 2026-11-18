export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) {
    throw new HttpError(response.status, body.message || body.issues?.[0]?.message || body.error || 'Không thể lưu dữ liệu. Hãy thử lại.');
  }
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
