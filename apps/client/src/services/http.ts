const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...requestOptions } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      credentials: "include",
      headers: {
        // Only declare JSON when we actually send a body (avoids needless CORS preflights on GET)
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Unable to connect to the server", 0, "NETWORK_ERROR");
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown = null;
  if (response.status !== 204) {
    try {
      payload = contentType.includes("application/json") ? await response.json() : await response.text();
    } catch {
      // Malformed body: fall through with null payload, status still decides success
    }
  }

  if (!response.ok) {
    const errorBody = (typeof payload === "object" && payload !== null ? payload : {}) as ApiErrorBody;

    throw new ApiError(
      errorBody.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorBody.error?.code ?? "REQUEST_FAILED",
      errorBody.error?.details,
    );
  }

  return payload as T;
}
