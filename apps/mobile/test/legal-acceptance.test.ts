import type { LegalAcceptanceResponse } from '@vse-pro-zhar/contracts';

import {
  acceptDevelopmentLegalDocument,
  loadDevelopmentLegalAcceptances,
  type LegalAcceptancePort,
} from '../src/application/legal-acceptance.ts';

const identity = { kind: 'development_identity' as const, phone: '+7 900 000-00-00' };
const requiredState: LegalAcceptanceResponse = {
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

describe('development legal acceptance application flow', () => {
  it('keeps only the exact backend-confirmed test-only state', async () => {
    const recordLegalAcceptance = jest.fn().mockResolvedValue({
      kind: 'legal_acceptances',
      legalAcceptances: requiredState,
    });
    const port: LegalAcceptancePort = {
      getCurrentLegalAcceptances: jest.fn().mockResolvedValue({
        kind: 'legal_acceptances',
        legalAcceptances: requiredState,
      }),
      recordLegalAcceptance,
    };

    await expect(loadDevelopmentLegalAcceptances(identity, port)).resolves.toEqual({
      kind: 'legal_acceptances_loaded',
      identity,
      legalAcceptances: requiredState,
    });
    await expect(acceptDevelopmentLegalDocument(identity, 'privacy_policy', port)).resolves.toEqual(
      {
        kind: 'legal_acceptance_saved',
        identity,
        legalAcceptances: requiredState,
      },
    );
    expect(recordLegalAcceptance).toHaveBeenCalledWith(identity, 'privacy_policy');
  });

  it('turns a failed acceptance request into an explicit safe failure', async () => {
    const port: LegalAcceptancePort = {
      getCurrentLegalAcceptances: jest
        .fn()
        .mockResolvedValue({ kind: 'failure', reason: 'timeout' }),
      recordLegalAcceptance: jest.fn().mockRejectedValue(new Error('network failure')),
    };

    await expect(loadDevelopmentLegalAcceptances(identity, port)).resolves.toEqual({
      kind: 'legal_acceptances_error',
      identity,
      reason: 'timeout',
    });
    await expect(acceptDevelopmentLegalDocument(identity, 'user_agreement', port)).resolves.toEqual(
      {
        kind: 'legal_acceptance_error',
        identity,
        reason: 'network',
      },
    );
  });
});
