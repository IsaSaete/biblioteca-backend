import { BookProviderError } from "./BookProvider.js";

export const DEFAULT_PROVIDER_TIMEOUT_MS = 5000;

export interface RequestJsonOptions {
  provider: string;
  url: URL;
  fetchFn: typeof fetch;
  timeoutMs: number;
  headers?: Record<string, string>;
}

// GET con timeout. Nunca incluye la URL en el error: puede llevar una API key.
const requestJson = async ({
  provider,
  url,
  fetchFn,
  timeoutMs,
  headers,
}: RequestJsonOptions): Promise<unknown> => {
  let response: Response;

  try {
    response = await fetchFn(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new BookProviderError(
      provider,
      "no responde o ha superado el tiempo",
    );
  }

  if (!response.ok) {
    throw new BookProviderError(provider, `respondió ${response.status}`);
  }

  try {
    return await response.json();
  } catch {
    throw new BookProviderError(provider, "respuesta no válida");
  }
};

export default requestJson;
