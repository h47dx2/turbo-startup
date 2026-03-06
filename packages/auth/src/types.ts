export type AccessTokenPayload = {
  sub: string;
  email: string;
  type: "access";
};

export type AuthTokenMeta = {
  expiresAt: Date;
  expiresInSeconds: number;
};

export type AccessTokenOptions = {
  secret: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
};
