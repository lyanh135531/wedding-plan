import {
  VendorDto,
  VendorSummaryDto,
  CreateVendorInput,
  UpdateVendorInput,
  QuoteDto,
  CreateQuoteInput,
  ReviseQuoteInput,
  QuoteToCostPreviewResponse,
  ConvertQuoteToCostInput,
  ConvertQuoteToCostResponse,
  ComparePackagesRequest,
  ComparePackagesResponse,
} from '@/schemas/vendors';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.headers && typeof options.headers === 'object' && !(options.headers instanceof Headers) && !Array.isArray(options.headers)) {
    Object.assign(headers, options.headers);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
    (headers as any)['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.error || 'API_ERROR',
      json.message || 'Đã xảy ra lỗi khi giao tiếp với máy chủ',
      json.details
    );
  }

  return json as T;
}

export const vendorsApi = {
  // 1. Vendors CRUD
  list: (params?: {
    search?: string;
    serviceType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.serviceType) sp.set('serviceType', params.serviceType);
    if (params?.status) sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return request<{
      data: (VendorSummaryDto | VendorDto)[];
      pagination: { page: number; limit: number; total: number };
    }>(`/api/v1/vendors${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string) =>
    request<{ data: VendorDto }>(`/api/v1/vendors/${id}`),

  create: (input: CreateVendorInput) =>
    request<{ data: VendorDto; message: string }>('/api/v1/vendors', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateVendorInput) =>
    request<{ data: VendorDto; message: string }>(`/api/v1/vendors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/api/v1/vendors/${id}`, {
      method: 'DELETE',
    }),

  // 2. Quotes & Versioning (AT24)
  listQuotes: (vendorId: string, includeSuperseded = true) =>
    request<{ data: QuoteDto[] }>(
      `/api/v1/vendors/${vendorId}/quotes?includeSuperseded=${includeSuperseded}`
    ),

  createQuote: (vendorId: string, input: CreateQuoteInput) =>
    request<{ data: QuoteDto; message: string }>(
      `/api/v1/vendors/${vendorId}/quotes`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    ),

  reviseQuote: (vendorId: string, parentQuoteId: string, input: ReviseQuoteInput) =>
    request<{ data: QuoteDto; message: string }>(
      `/api/v1/vendors/${vendorId}/quotes`,
      {
        method: 'POST',
        body: JSON.stringify({ ...input, parent_quote_id: parentQuoteId }),
      }
    ),

  // 3. Quote to Cost Conversion (AT23)
  getQuoteToCostPreview: (vendorId: string, quoteId: string) =>
    request<{ data: QuoteToCostPreviewResponse }>(
      `/api/v1/vendors/${vendorId}/quotes/${quoteId}/create-cost-item`
    ),

  convertQuoteToCost: (
    vendorId: string,
    quoteId: string,
    input: ConvertQuoteToCostInput,
    idempotencyKey?: string
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return request<{ data: ConvertQuoteToCostResponse; message: string }>(
      `/api/v1/vendors/${vendorId}/quotes/${quoteId}/create-cost-item`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      }
    );
  },

  // 4. Comparison (AT24)
  compare: (body: ComparePackagesRequest) =>
    request<ComparePackagesResponse>('/api/v1/vendors/compare', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
