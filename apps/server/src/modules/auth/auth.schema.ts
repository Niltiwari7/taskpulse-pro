import {z} from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
})


export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>