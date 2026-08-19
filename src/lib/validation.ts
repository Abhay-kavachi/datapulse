// ============================================================================
// DataPulse — Input Validation Schemas (Zod)
// Centralized allow-lists enforced at every route boundary.
// ============================================================================

import { z } from 'zod';
import { METRICS, REGIONS, ANOMALY_STATUSES, WINDOW_PRESETS } from '@/lib/types';
import { DATASET_START, DATASET_END } from '@/lib/data/scenarios';

// ---------------------------------------------------------------------------
// Base validators
// ---------------------------------------------------------------------------

const datasetStartMs = new Date(DATASET_START).getTime();
const datasetEndMs = new Date(DATASET_END).getTime();

/** ISO 8601 timestamp within the dataset's 24-hour range */
export const timestampSchema = z
  .string()
  .refine(
    (val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      const ms = d.getTime();
      return ms >= datasetStartMs && ms <= datasetEndMs;
    },
    { message: 'Timestamp must be a valid ISO 8601 date within the dataset range' }
  );

/** Allow-listed metric enum */
export const metricSchema = z.enum(METRICS);

/** Allow-listed region enum */
export const regionSchema = z.enum(REGIONS);

/** Allow-listed anomaly status */
export const statusSchema = z.enum(ANOMALY_STATUSES);

/** Allow-listed window preset */
export const windowPresetSchema = z.enum(WINDOW_PRESETS);

/** Numeric severity (0-100) */
export const severitySchema = z.coerce.number().min(0).max(100);

/** Playback speed */
export const speedSchema = z.coerce.number().refine(
  (val) => [1, 4, 30].includes(val),
  { message: 'Speed must be 1, 4, or 30' }
);

// ---------------------------------------------------------------------------
// Route-specific schemas
// ---------------------------------------------------------------------------

export const pulseQuerySchema = z.object({
  t: timestampSchema,
  region: regionSchema.optional(),
});

export const anomaliesQuerySchema = z.object({
  t: timestampSchema,
  region: regionSchema.optional(),
  metric: metricSchema.optional(),
  status: statusSchema.optional(),
  minSeverity: severitySchema.optional(),
});

export const cascadeQuerySchema = z.object({
  t: timestampSchema,
});

export const evidenceQuerySchema = z.object({
  t: timestampSchema,
});

export const whatChangedQuerySchema = z.object({
  t: timestampSchema,
  window: windowPresetSchema,
});

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[] | undefined>
): ValidationResult<T> {
  // Convert URLSearchParams-style to plain object
  const clean: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(params)) {
    clean[key] = Array.isArray(val) ? val[0] : val;
  }

  const result = schema.safeParse(clean);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const messages = result.error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
  return { success: false, error: messages };
}
