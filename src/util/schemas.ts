// src/util/schemas.ts
// NEW
// minimal schemas for validating UI message metadata and custom data parts
import { z } from 'zod';

// match the lightweight metadata you attach in route.ts
export const metadataSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  // LanguageModelUsage is opaque here; store totals if present
  totalUsage: z
    .object({
      totalTokens: z.number().optional(),
    })
    .optional(),
});

// accept the default data parts (text etc.) — extend if you add custom parts
export const dataPartsSchema = z.any();
