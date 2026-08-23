import { z } from 'zod';

export const LegalDocumentTypeSchema = z.enum(['privacy_policy', 'user_agreement']);

const TestLegalDocumentVersionSchema = z.enum(['test-privacy-policy-v1', 'test-user-agreement-v1']);

const LegalAcceptanceStatusSchema = z.enum(['required', 'accepted']);

export const LegalAcceptanceDocumentSchema = z
  .object({
    acceptedAt: z.iso.datetime({ offset: true }).nullable(),
    documentType: LegalDocumentTypeSchema,
    documentVersion: TestLegalDocumentVersionSchema,
    status: LegalAcceptanceStatusSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const expectedVersion =
      value.documentType === 'privacy_policy' ? 'test-privacy-policy-v1' : 'test-user-agreement-v1';
    if (value.documentVersion !== expectedVersion) {
      context.addIssue({
        code: 'custom',
        message: 'Document version does not match document type',
      });
    }
    if (
      (value.status === 'accepted' && value.acceptedAt === null) ||
      (value.status === 'required' && value.acceptedAt !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'Acceptance status does not match acceptedAt' });
    }
  });

export const LegalAcceptanceResponseSchema = z
  .object({
    documents: z.array(LegalAcceptanceDocumentSchema).length(2),
    mode: z.literal('test_only'),
  })
  .strict()
  .superRefine((value, context) => {
    const types = new Set(value.documents.map((document) => document.documentType));
    if (types.size !== 2 || !types.has('privacy_policy') || !types.has('user_agreement')) {
      context.addIssue({
        code: 'custom',
        message: 'Both required legal documents must be present',
      });
    }
  });

export const RecordLegalAcceptanceRequestSchema = z
  .object({ documentType: LegalDocumentTypeSchema })
  .strict();

export type LegalAcceptanceDocument = z.infer<typeof LegalAcceptanceDocumentSchema>;
export type LegalAcceptanceResponse = z.infer<typeof LegalAcceptanceResponseSchema>;
export type LegalDocumentType = z.infer<typeof LegalDocumentTypeSchema>;
export type RecordLegalAcceptanceRequest = z.infer<typeof RecordLegalAcceptanceRequestSchema>;

export function parseLegalAcceptanceResponse(payload: unknown): LegalAcceptanceResponse {
  return LegalAcceptanceResponseSchema.parse(payload);
}
