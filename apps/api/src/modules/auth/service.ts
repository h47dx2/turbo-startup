import {
  ACCESS_TOKEN_TYPE,
  generateRefreshToken,
  generateTokenFamily,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
  verifyPassword
} from "@repo/auth";
import { prisma } from "@repo/database";
import type {
  AuthSuccessResponse,
  LoginInput,
  RegisterInput,
  UserPublic
} from "@repo/validation";
import { conflict, unauthorized } from "../../lib/errors.js";
import type { AuthServiceContext, RequestMeta } from "./types.js";

type IssueSessionInput = {
  userId: string;
  email: string;
  family?: string;
  parentTokenId?: string | null;
  meta?: RequestMeta;
};

function toPublicUser(user: {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString()
  };
}

async function createAccessToken(ctx: AuthServiceContext, user: { id: string; email: string }) {
  return signAccessToken(
    {
      sub: user.id,
      email: user.email,
      type: ACCESS_TOKEN_TYPE
    },
    {
      secret: ctx.env.JWT_ACCESS_SECRET,
      issuer: ctx.env.JWT_ISSUER,
      audience: ctx.env.JWT_AUDIENCE,
      ttlSeconds: ctx.env.ACCESS_TOKEN_TTL_SECONDS
    }
  );
}

async function issueSession(ctx: AuthServiceContext, input: IssueSessionInput) {
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken, ctx.env.REFRESH_TOKEN_PEPPER);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ctx.env.REFRESH_TOKEN_TTL_SECONDS * 1000);

  const refreshTokenRecord = await prisma.refreshToken.create({
    data: {
      userId: input.userId,
      tokenHash,
      family: input.family ?? generateTokenFamily(),
      parentTokenId: input.parentTokenId,
      issuedAt: now,
      expiresAt,
      userAgent: input.meta?.userAgent,
      ipAddress: input.meta?.ipAddress
    }
  });

  if (input.parentTokenId) {
    await prisma.refreshToken.update({
      where: { id: input.parentTokenId },
      data: { replacedByTokenId: refreshTokenRecord.id, revokedAt: now }
    });
  }

  const { token, meta } = await createAccessToken(ctx, {
    id: input.userId,
    email: input.email
  });

  return {
    refreshToken: rawRefreshToken,
    refreshTokenRecord,
    token,
    tokenExpiresInSeconds: meta.expiresInSeconds
  };
}

export async function register(ctx: AuthServiceContext, input: RegisterInput, meta: RequestMeta) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw conflict("Email is already in use", "email_in_use");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: input.name ?? null,
      passwordHash
    }
  });

  const session = await issueSession(ctx, {
    userId: user.id,
    email: user.email,
    meta
  });

  const response: AuthSuccessResponse = {
    user: toPublicUser(user),
    token: {
      accessToken: session.token,
      tokenType: "Bearer",
      expiresInSeconds: session.tokenExpiresInSeconds
    }
  };

  return {
    response,
    refreshToken: session.refreshToken
  };
}

export async function login(ctx: AuthServiceContext, input: LoginInput, meta: RequestMeta) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw unauthorized("Invalid email or password", "invalid_credentials");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw unauthorized("Invalid email or password", "invalid_credentials");
  }

  const session = await issueSession(ctx, {
    userId: user.id,
    email: user.email,
    meta
  });

  const response: AuthSuccessResponse = {
    user: toPublicUser(user),
    token: {
      accessToken: session.token,
      tokenType: "Bearer",
      expiresInSeconds: session.tokenExpiresInSeconds
    }
  };

  return {
    response,
    refreshToken: session.refreshToken
  };
}

export async function refreshSession(ctx: AuthServiceContext, rawRefreshToken: string, meta: RequestMeta) {
  const tokenHash = hashRefreshToken(rawRefreshToken, ctx.env.REFRESH_TOKEN_PEPPER);
  const tokenRecord = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!tokenRecord) {
    throw unauthorized("Refresh token is invalid", "invalid_refresh_token");
  }

  const now = new Date();

  if (tokenRecord.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        family: tokenRecord.family,
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    throw unauthorized("Refresh token replay detected", "refresh_replay_detected");
  }

  if (tokenRecord.expiresAt <= now) {
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: now }
    });

    throw unauthorized("Refresh token expired", "refresh_token_expired");
  }

  const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
  if (!user) {
    throw unauthorized("User not found", "user_not_found");
  }

  const session = await issueSession(ctx, {
    userId: user.id,
    email: user.email,
    family: tokenRecord.family,
    parentTokenId: tokenRecord.id,
    meta
  });

  const response: AuthSuccessResponse = {
    user: toPublicUser(user),
    token: {
      accessToken: session.token,
      tokenType: "Bearer",
      expiresInSeconds: session.tokenExpiresInSeconds
    }
  };

  return {
    response,
    refreshToken: session.refreshToken
  };
}

export async function logout(ctx: AuthServiceContext, rawRefreshToken?: string) {
  if (!rawRefreshToken) {
    return;
  }

  const tokenHash = hashRefreshToken(rawRefreshToken, ctx.env.REFRESH_TOKEN_PEPPER);
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function logoutAll(ctx: AuthServiceContext, accessToken: string) {
  const payload = await verifyAccessToken(accessToken, {
    secret: ctx.env.JWT_ACCESS_SECRET,
    issuer: ctx.env.JWT_ISSUER,
    audience: ctx.env.JWT_AUDIENCE,
    ttlSeconds: ctx.env.ACCESS_TOKEN_TTL_SECONDS
  });

  await prisma.refreshToken.updateMany({
    where: {
      userId: payload.sub,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function getCurrentUser(ctx: AuthServiceContext, accessToken: string) {
  const payload = await verifyAccessToken(accessToken, {
    secret: ctx.env.JWT_ACCESS_SECRET,
    issuer: ctx.env.JWT_ISSUER,
    audience: ctx.env.JWT_AUDIENCE,
    ttlSeconds: ctx.env.ACCESS_TOKEN_TTL_SECONDS
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  if (!user) {
    throw unauthorized("User not found", "user_not_found");
  }

  return toPublicUser(user);
}
