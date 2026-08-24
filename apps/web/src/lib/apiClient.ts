// Thin fetch wrapper: sends the httpOnly auth cookie automatically,
// transparently retries once via /auth/refresh on a 401, and throws a
// normalized Error with the server's message for callers to catch.
const BASE = "/api";

class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  if (res.status === 401 && !retried && path !== "/auth/refresh") {
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) return request<T>(path, options, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiClientError(res.status, body.error ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiClientError };
