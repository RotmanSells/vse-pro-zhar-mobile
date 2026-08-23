import type { LegalAcceptanceResponse, LegalDocumentType } from '@vse-pro-zhar/contracts';

import type { CustomerProfileFailureReason } from './customer-profile.ts';
import type { DevelopmentIdentity } from './development-identity.ts';

export type LegalAcceptanceFailureReason = CustomerProfileFailureReason;

export type CurrentLegalAcceptanceResult =
  | { readonly kind: 'legal_acceptances'; readonly legalAcceptances: LegalAcceptanceResponse }
  | { readonly kind: 'failure'; readonly reason: LegalAcceptanceFailureReason };

export interface LegalAcceptancePort {
  getCurrentLegalAcceptances(identity: DevelopmentIdentity): Promise<CurrentLegalAcceptanceResult>;
  recordLegalAcceptance(
    identity: DevelopmentIdentity,
    documentType: LegalDocumentType,
  ): Promise<CurrentLegalAcceptanceResult>;
}

export type DevelopmentLegalAcceptanceLoadResult =
  | {
      readonly kind: 'legal_acceptances_loaded';
      readonly identity: DevelopmentIdentity;
      readonly legalAcceptances: LegalAcceptanceResponse;
    }
  | {
      readonly kind: 'legal_acceptances_error';
      readonly identity: DevelopmentIdentity;
      readonly reason: LegalAcceptanceFailureReason;
    };

export type DevelopmentLegalAcceptanceSaveResult =
  | {
      readonly kind: 'legal_acceptance_saved';
      readonly identity: DevelopmentIdentity;
      readonly legalAcceptances: LegalAcceptanceResponse;
    }
  | {
      readonly kind: 'legal_acceptance_error';
      readonly identity: DevelopmentIdentity;
      readonly reason: LegalAcceptanceFailureReason;
    };

export async function loadDevelopmentLegalAcceptances(
  identity: DevelopmentIdentity,
  legalAcceptancePort: LegalAcceptancePort,
): Promise<DevelopmentLegalAcceptanceLoadResult> {
  try {
    const result = await legalAcceptancePort.getCurrentLegalAcceptances(identity);
    return result.kind === 'legal_acceptances'
      ? { kind: 'legal_acceptances_loaded', identity, legalAcceptances: result.legalAcceptances }
      : { kind: 'legal_acceptances_error', identity, reason: result.reason };
  } catch {
    return { kind: 'legal_acceptances_error', identity, reason: 'network' };
  }
}

export async function acceptDevelopmentLegalDocument(
  identity: DevelopmentIdentity,
  documentType: LegalDocumentType,
  legalAcceptancePort: LegalAcceptancePort,
): Promise<DevelopmentLegalAcceptanceSaveResult> {
  try {
    const result = await legalAcceptancePort.recordLegalAcceptance(identity, documentType);
    return result.kind === 'legal_acceptances'
      ? { kind: 'legal_acceptance_saved', identity, legalAcceptances: result.legalAcceptances }
      : { kind: 'legal_acceptance_error', identity, reason: result.reason };
  } catch {
    return { kind: 'legal_acceptance_error', identity, reason: 'network' };
  }
}
