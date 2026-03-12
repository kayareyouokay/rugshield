import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

export interface JsonRequestOptions {
  source: string;
  url: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

export interface JsonRequestSuccess<T> {
  ok: true;
  data: T;
  statusCode: number;
}

export interface JsonRequestFailure {
  ok: false;
  error: string;
  statusCode?: number;
}

export type JsonRequestResult<T> = JsonRequestSuccess<T> | JsonRequestFailure;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function isRetryable(statusCode?: number) {
  if (!statusCode) {
    return true;
  }

  return RETRYABLE_STATUS.has(statusCode);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeError(source: string, error: unknown): JsonRequestFailure {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    const responseMessage =
      typeof error.response?.data === "object" &&
      error.response?.data &&
      "message" in error.response.data &&
      typeof error.response.data.message === "string"
        ? error.response.data.message
        : undefined;

    return {
      ok: false,
      statusCode,
      error:
        responseMessage ||
        error.message ||
        `${source} request failed${statusCode ? ` (${statusCode})` : ""}.`,
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: `${source} request failed: ${error.message}`,
    };
  }

  return {
    ok: false,
    error: `${source} request failed due to an unknown error.`,
  };
}

export async function getJson<T>(
  options: JsonRequestOptions,
): Promise<JsonRequestResult<T>> {
  const retries = Math.max(0, options.retries ?? 1);
  const timeout = Math.max(1_000, options.timeoutMs ?? 7_000);

  const requestConfig: AxiosRequestConfig = {
    method: "get",
    url: options.url,
    params: options.params,
    headers: options.headers,
    timeout,
    validateStatus: () => true,
  };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response: AxiosResponse<T> = await axios.request<T>(requestConfig);

      if (response.status >= 200 && response.status < 300) {
        return {
          ok: true,
          data: response.data,
          statusCode: response.status,
        };
      }

      const failure: JsonRequestFailure = {
        ok: false,
        statusCode: response.status,
        error: `${options.source} responded with HTTP ${response.status}.`,
      };

      if (attempt < retries && isRetryable(response.status)) {
        await sleep(250 * (attempt + 1));
        continue;
      }

      return failure;
    } catch (error) {
      const failure = normalizeError(options.source, error);

      if (attempt < retries && isRetryable(failure.statusCode)) {
        await sleep(250 * (attempt + 1));
        continue;
      }

      return failure;
    }
  }

  return {
    ok: false,
    error: `${options.source} request exhausted retries.`,
  };
}
