import type { LegalAcceptanceResponse, LegalDocumentType } from '@vse-pro-zhar/contracts';

import {
  TEST_LEGAL_DOCUMENTS,
  type LegalAcceptance,
  type LegalDocumentDefinition,
} from '../domain/customer/legal-acceptance.ts';
import type { CustomerProfileRepository, DevelopmentIdentity } from './customer-profile.ts';

export interface LegalAcceptanceRepository {
  listByCustomerId(customerId: string): Promise<readonly LegalAcceptance[]>;
  recordAcceptance(customerId: string, document: LegalDocumentDefinition): Promise<LegalAcceptance>;
}

function toResponse(acceptances: readonly LegalAcceptance[]): LegalAcceptanceResponse {
  return {
    documents: TEST_LEGAL_DOCUMENTS.map((document) => {
      const acceptance = acceptances.find(
        (candidate) =>
          candidate.documentType === document.documentType &&
          candidate.documentVersion === document.documentVersion,
      );
      return acceptance === undefined
        ? {
            acceptedAt: null,
            documentType: document.documentType,
            documentVersion: document.documentVersion,
            status: 'required' as const,
          }
        : {
            acceptedAt: acceptance.acceptedAt,
            documentType: document.documentType,
            documentVersion: document.documentVersion,
            status: 'accepted' as const,
          };
    }),
    mode: 'test_only',
  };
}

async function resolveCustomerId(
  identity: DevelopmentIdentity,
  customerProfileRepository: CustomerProfileRepository,
): Promise<string> {
  const profile = await customerProfileRepository.findOrCreateByPhone(identity.phone);
  return profile.customerId;
}

export async function getCurrentLegalAcceptances(
  identity: DevelopmentIdentity,
  customerProfileRepository: CustomerProfileRepository,
  legalAcceptanceRepository: LegalAcceptanceRepository,
): Promise<LegalAcceptanceResponse> {
  const customerId = await resolveCustomerId(identity, customerProfileRepository);
  return toResponse(await legalAcceptanceRepository.listByCustomerId(customerId));
}

export async function recordCurrentLegalAcceptance(
  identity: DevelopmentIdentity,
  documentType: LegalDocumentType,
  customerProfileRepository: CustomerProfileRepository,
  legalAcceptanceRepository: LegalAcceptanceRepository,
): Promise<LegalAcceptanceResponse> {
  const document = TEST_LEGAL_DOCUMENTS.find(
    (candidate) => candidate.documentType === documentType,
  );
  if (document === undefined) throw new Error('Unsupported legal document type');

  const customerId = await resolveCustomerId(identity, customerProfileRepository);
  await legalAcceptanceRepository.recordAcceptance(customerId, document);
  return toResponse(await legalAcceptanceRepository.listByCustomerId(customerId));
}
