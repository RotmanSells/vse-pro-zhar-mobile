export const LEGAL_DOCUMENT_TYPES = ['privacy_policy', 'user_agreement'] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export type TestLegalDocumentVersion = 'test-privacy-policy-v1' | 'test-user-agreement-v1';

export interface LegalDocumentDefinition {
  readonly documentType: LegalDocumentType;
  readonly documentVersion: TestLegalDocumentVersion;
}

export interface LegalAcceptance {
  readonly acceptedAt: string;
  readonly customerId: string;
  readonly documentType: LegalDocumentType;
  readonly documentVersion: string;
}

export const TEST_LEGAL_DOCUMENTS: readonly LegalDocumentDefinition[] = [
  {
    documentType: 'privacy_policy',
    documentVersion: 'test-privacy-policy-v1',
  },
  {
    documentType: 'user_agreement',
    documentVersion: 'test-user-agreement-v1',
  },
];

export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return LEGAL_DOCUMENT_TYPES.includes(value as LegalDocumentType);
}
