// Тонкая обёртка над fetch для API бэкенда (dashboard/server.js) —
// всегда тот же origin, что и сама SPA (Caddy проксирует и статику, и
// /api/* на один и тот же процесс), поэтому ни базового URL, ни CORS не
// требуется. credentials: 'same-origin' — чтобы httpOnly-cookie сессии
// (dashboard/session.js) всегда уходила вместе с запросом.
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', ...init?.headers },
        ...init,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError((body as { error?: string } | null)?.error ?? res.statusText, res.status);
    }
    return res.json() as Promise<T>;
}

export function getJson<T>(path: string): Promise<T> {
    return request<T>(path);
}

export function putJson<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
