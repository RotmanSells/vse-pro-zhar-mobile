import { z } from 'zod';

export const CustomerProfileResponseSchema = z
  .object({
    customerId: z.uuid(),
    phone: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(200).nullable(),
    birthday: z.iso.date().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const CustomerProfilePatchRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).nullable().optional(),
    birthday: z.iso.date().nullable().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.birthday !== undefined, {
    message: 'At least one profile field is required',
  });

export type CustomerProfileResponse = z.infer<typeof CustomerProfileResponseSchema>;
export type CustomerProfilePatchRequest = z.infer<typeof CustomerProfilePatchRequestSchema>;

export function parseCustomerProfileResponse(payload: unknown): CustomerProfileResponse {
  return CustomerProfileResponseSchema.parse(payload);
}
