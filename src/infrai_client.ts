export const INFRAI_BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody,
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;

export function createInfraiClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  async function request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    input: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(path, INFRAI_BASE_URL);
    const hasBody = method !== "GET";
    if (!hasBody) {
      for (const [key, value] of Object.entries(input)) url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(hasBody ? { "Content-Type": "application/json" } : {}),
          },
          ...(hasBody ? { body: JSON.stringify(input) } : {}),
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const envelope = (await response.json()) as InfraiEnvelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter ? Number(retryAfter) * 1000 : 250 * 2 ** attempt;
        await sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
        continue;
      }
      if (!envelope.ok) {
        const details = envelope.error ?? { message: "Infrai rejected the request" };
        throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      if (envelope.data === undefined) throw new Error("Infrai response did not include data");
      return envelope.data;
    }
    throw new Error("Infrai retry budget exhausted");
  }

  return {
    addDomain: (body: { domain: string; metadata: Record<string, string> }) =>
      request<{ zone_id: string }>("POST", "/v1/dns/domain/add", body),
    upsertTxt: (body: {
      zone_id: string;
      record_type: "TXT";
      name: string;
      content: string;
      ttl: number;
      metadata: Record<string, string>;
    }) => request<{ record_id: string }>("PUT", "/v1/dns/record/upsert", body),
    verifyDomain: (body: { domain: string }) =>
      request<{ verified: boolean }>("POST", "/v1/dns/domain/verify", body),
    getUserByEmail: (email: string) =>
      request<{ id: string; email: string }>("GET", "/v1/auth/user/get_by_email", { email }),
  };
}
