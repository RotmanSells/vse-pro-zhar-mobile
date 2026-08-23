import type { LegalAcceptanceResponse } from '@vse-pro-zhar/contracts';

import type { DevelopmentIdentity } from '../src/application/development-identity.ts';
import {
  createLegalAcceptanceApiClient,
  type LegalAcceptanceFetch,
} from '../src/infrastructure/legal-acceptance-api-client.ts';

const identity: DevelopmentIdentity = {
  kind: 'development_identity',
  phone: '  +7 900 000-00-00  ',
};

const legalAcceptances: LegalAcceptanceResponse = {
  documents: [
    {
      acceptedAt: null,
      documentType: 'privacy_policy',
      documentVersion: 'test-privacy-policy-v1',
      status: 'required',
    },
    {
      acceptedAt: null,
      documentType: 'user_agreement',
      documentVersion: 'test-user-agreement-v1',
      status: 'required',
    },
  ],
  mode: 'test_only',
};

describe('legal acceptance API client', () => {
  it('loads test-only state and records one explicit document through the shared contract', async () => {
    const fetchImpl = jest
      .fn<ReturnType<LegalAcceptanceFetch>, Parameters<LegalAcceptanceFetch>>()
      .mockResolvedValueOnce(new Response(JSON.stringify(legalAcceptances), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(legalAcceptances), { status: 200 }));
    const client = createLegalAcceptanceApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl,
    });

    await expect(client.getCurrentLegalAcceptances(identity)).resolves.toEqual({
      kind: 'legal_acceptances',
      legalAcceptances,
    });
    await expect(client.recordLegalAcceptance(identity, 'privacy_policy')).resolves.toEqual({
      kind: 'legal_acceptances',
      legalAcceptances,
    });

    const loadRequest = fetchImpl.mock.calls[0];
    const acceptanceRequest = fetchImpl.mock.calls[1];
    if (loadRequest === undefined || acceptanceRequest === undefined) {
      throw new Error('Expected both legal acceptance requests');
    }
    expect(loadRequest[0]).toBe('http://10.0.2.2:3100/me/legal-acceptances');
    expect(loadRequest[1]).toMatchObject({
      headers: {
        Accept: 'application/json',
        'X-VPZH-Development-Identity': '+7 900 000-00-00',
      },
      method: 'GET',
    });
    expect(acceptanceRequest[1]).toMatchObject({
      headers: {
        'Content-Type': 'application/json',
        'X-VPZH-Development-Identity': '+7 900 000-00-00',
      },
      method: 'POST',
    });
    const requestBody = acceptanceRequest[1]?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body');
    expect(JSON.parse(requestBody) as unknown).toEqual({
      documentType: 'privacy_policy',
    });
  });

  it.each([
    [new Response('{}', { status: 200 }), 'invalid_response'],
    [new Response('{}', { status: 401 }), 'unauthorized'],
    [new Response('{}', { status: 500 }), 'http'],
  ] as const)('never treats an invalid response as accepted', async (response, reason) => {
    const client = createLegalAcceptanceApiClient({
      apiBaseUrl: 'http://10.0.2.2:3100',
      fetchImpl: jest.fn().mockResolvedValue(response),
    });

    await expect(client.recordLegalAcceptance(identity, 'user_agreement')).resolves.toEqual({
      kind: 'failure',
      reason,
    });
  });
});
