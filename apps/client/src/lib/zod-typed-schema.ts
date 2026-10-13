import type { TypedSchema } from "vee-validate"
import { z } from "zod"

// Minimal vee-validate adapter for zod 4. @vee-validate/zod only supports zod 3.
// Uses flattenError, so it supports flat (non-nested) forms only.
export function toTypedSchema<TSchema extends z.ZodType>(
  schema: TSchema,
): TypedSchema<z.input<TSchema>, z.output<TSchema>> {
  return {
    __type: "VVTypedSchema",
    async parse(values) {
      const result = await schema.safeParseAsync(values)
      if (result.success) return { value: result.data, errors: [] }

      const { fieldErrors } = z.flattenError(result.error)
      return {
        errors: Object.entries(fieldErrors).map(([path, errors]) => ({ path, errors: errors as string[] })),
      }
    },
  }
}
