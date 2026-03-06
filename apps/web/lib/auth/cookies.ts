import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE_NAME } from "./constants";
import { getWebEnv } from "../env";

export async function setAccessTokenCookie(accessToken: string, maxAgeSeconds: number) {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: getWebEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds
  });
}

export async function clearAccessTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE_NAME);
}
