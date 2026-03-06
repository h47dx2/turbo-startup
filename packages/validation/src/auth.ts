import { z } from "zod";

export const emailSchema = z.email().trim().toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(64).optional()
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
});

export const refreshInputSchema = z
  .object({
    refreshToken: z.string().min(1)
  })
  .partial();

export const logoutInputSchema = z
  .object({
    refreshToken: z.string().min(1)
  })
  .partial();

export const userPublicSchema = z.object({
  id: z.string().min(1),
  email: emailSchema,
  name: z.string().nullable(),
  createdAt: z.string().datetime()
});

export const accessTokenSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  expiresInSeconds: z.number().int().positive()
});

export const authSuccessSchema = z.object({
  user: userPublicSchema,
  token: accessTokenSchema,
  refreshToken: z.string().min(1).optional()
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional()
  })
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RefreshInput = z.infer<typeof refreshInputSchema>;
export type LogoutInput = z.infer<typeof logoutInputSchema>;
export type UserPublic = z.infer<typeof userPublicSchema>;
export type AccessTokenResponse = z.infer<typeof accessTokenSchema>;
export type AuthSuccessResponse = z.infer<typeof authSuccessSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
