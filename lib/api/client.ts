/**
 * Typed client-side wrapper around `fetch` for this app's API routes.
 *
 * Every route responds with the `ApiResponse` envelope from
 * `lib/api/response.ts` (`{ success, data, message }` on success,
 * `{ success: false, message | error, code?, errors? }` on failure).
 * This client unwraps the envelope and throws `ApiClientError` on any
 * HTTP or application-level failure, so call sites only handle the
 * happy path plus a single catch.
 */

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export class ApiClientError extends Error {
  status: number;
  code?: string;
  /** Field-level validation errors, when the server provides them. */
  errors?: Record<string, string[]>;
  retryAfter?: number;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      errors?: Record<string, string[]>;
      retryAfter?: number;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.errors = options.errors;
    this.retryAfter = options.retryAfter;
  }
}

/** Serialize params, skipping undefined/null/empty-string values. */
export function buildQueryString(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiResult<T> {
  data: T;
  message?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const url = `${path}${buildQueryString(options.query)}`;
  const init: RequestInit = { method, signal: options.signal };

  const headers: Record<string, string> = { ...options.headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (Object.keys(headers).length > 0) init.headers = headers;

  const response = await fetch(url, init);

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.success === false) {
    throw new ApiClientError(
      json?.message || json?.error || response.statusText || "Request failed",
      {
        status: response.status,
        code: json?.code,
        errors: json?.errors,
        retryAfter: json?.retryAfter,
      },
    );
  }

  return { data: json?.data as T, message: json?.message };
}

export const apiClient = {
  /** Full envelope access when the caller needs the server message. */
  request,

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return (await request<T>("GET", path, undefined, options)).data;
  },

  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return (await request<T>("POST", path, body, options)).data;
  },

  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return (await request<T>("PUT", path, body, options)).data;
  },

  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return (await request<T>("PATCH", path, body, options)).data;
  },

  async delete<T = unknown>(
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    return (await request<T>("DELETE", path, undefined, options)).data;
  },
};
