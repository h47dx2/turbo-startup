import { apiErrorSchema, type ApiErrorResponse } from "@repo/validation";

export type ApiClientOptions = {
  baseUrl: string;
  cookie?: string;
  accessToken?: string;
};

export type JsonRequestInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly response: ApiErrorResponse | null;

  constructor(message: string, status: number, response: ApiErrorResponse | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.response = response;
  }
}

export function createApiClient(options: ApiClientOptions) {
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json"
  };

  if (options.cookie) {
    baseHeaders.cookie = options.cookie;
  }

  if (options.accessToken) {
    baseHeaders.authorization = `Bearer ${options.accessToken}`;
  }

  return {
    async rawRequest(input: JsonRequestInit): Promise<Response> {
      return fetch(`${options.baseUrl}${input.path}`, {
        method: input.method ?? "GET",
        headers: {
          ...baseHeaders,
          ...input.headers
        },
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        signal: input.signal
      });
    },
    async request<T>(input: JsonRequestInit): Promise<T> {
      const response = await this.rawRequest(input);

      if (!response.ok) {
        let errorPayload: ApiErrorResponse | null = null;

        try {
          const json = await response.json();
          errorPayload = apiErrorSchema.safeParse(json).success ? (json as ApiErrorResponse) : null;
        } catch {
          errorPayload = null;
        }

        throw new ApiClientError(errorPayload?.error.message ?? "API request failed", response.status, errorPayload);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    }
  };
}
