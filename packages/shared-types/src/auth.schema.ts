import { z } from 'zod'

// Shared by the server (request validation) and the client (form validation),
// so both sides always enforce the same rules with the same messages.
// `error` on the base type replaces zod's default "expected string, received undefined";
// `.min(1)` covers the empty-string case once the user has typed.

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254, 'Email must be at most 254 characters')

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
})

export const registerSchema = z.object({
  username: z
    .string({ error: 'Username is required' })
    .trim()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters'),
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
