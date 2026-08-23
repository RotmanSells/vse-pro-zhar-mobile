import {
  LegalAcceptanceResponseSchema,
  RecordLegalAcceptanceRequestSchema,
} from '@vse-pro-zhar/contracts';

import type {
  CurrentLegalAcceptanceResult,
  LegalAcceptanceFailureReason,
  LegalAcceptancePort,
} from '../application/legal-acceptance.ts';

export const LEGAL_ACCEPTANCE_REQUEST_TIMEOUT_MS = 3_000;

export interface LegalAcceptanceFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface CreateLegalAcceptanceApiClientOptions {
  readonly apiBaseUrl?: string | undefined;
  readonly fetchImpl?: LegalAcceptanceFetch;
  readonly timeoutMs?: number;
}

function failure(reason: LegalAcceptanceFailureReason): CurrentLegalAcceptanceResult {
  return { kind: 'failure', reason };
}

export function createLegalAcceptanceApiClient(
  options: CreateLegalAcceptanceApiClientOptions,
): LegalAcceptancePort {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? LEGAL_ACCEPTANCE_REQUEST_TIMEOUT_MS;
  const apiBaseUrl = options.apiBaseUrl;

  async function requestLegalAcceptances({
    body,
    identity,
    method,
  }: {
    readonly body?: string;
    readonly identity: Parameters<LegalAcceptancePort['getCurrentLegalAcceptances']>[0];
    readonly method: 'GET' | 'POST';
  }): Promise<CurrentLegalAcceptanceResult> {
    if (apiBaseUrl === undefined) return failure('configuration');

    const phone = identity.phone.trim();
    if (phone.length === 0) return failure('unauthorized');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response: Response;
      try {
        response = await fetchImpl(`${apiBaseUrl}/me/legal-acceptances`, {
          ...(body === undefined ? {} : { body }),
          headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            'X-VPZH-Development-Identity': phone,
          },
          method,
          signal: controller.signal,
        });
      } catch {
        return failure(controller.signal.aborted ? 'timeout' : 'network');
      }
      if (!response.ok) return failure(response.status === 401 ? 'unauthorized' : 'http');

      let payload: unknown;
      try {
        payload = (await response.json()) as unknown;
      } catch {
        return failure(controller.signal.aborted ? 'timeout' : 'invalid_response');
      }
      const parsed = LegalAcceptanceResponseSchema.safeParse(payload);
      return parsed.success
        ? { kind: 'legal_acceptances', legalAcceptances: parsed.data }
        : failure('invalid_response');
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    getCurrentLegalAcceptances(identity): Promise<CurrentLegalAcceptanceResult> {
      return requestLegalAcceptances({ identity, method: 'GET' });
    },
    recordLegalAcceptance(identity, documentType): Promise<CurrentLegalAcceptanceResult> {
      const parsedRequest = RecordLegalAcceptanceRequestSchema.safeParse({ documentType });
      if (!parsedRequest.success) return Promise.resolve(failure('invalid_request'));
      return requestLegalAcceptances({
        body: JSON.stringify(parsedRequest.data),
        identity,
        method: 'POST',
      });
    },
  };
}
