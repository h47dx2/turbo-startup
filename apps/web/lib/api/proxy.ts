import { createApiClient } from "@repo/api-client";
import type { NextRequest, NextResponse } from "next/server";
import { getWebEnv } from "../env";

export function createServerApiClient(request: NextRequest, accessToken?: string) {
  return createApiClient({
    baseUrl: getWebEnv().API_BASE_URL,
    cookie: request.headers.get("cookie") ?? undefined,
    accessToken
  });
}

export function forwardSetCookieHeaders(from: Response, to: NextResponse) {
  const cookieList = from.headers.getSetCookie?.() ?? [];

  if (cookieList.length > 0) {
    for (const cookieHeader of cookieList) {
      to.headers.append("set-cookie", cookieHeader);
    }
    return;
  }

  const singleCookie = from.headers.get("set-cookie");
  if (singleCookie) {
    to.headers.append("set-cookie", singleCookie);
  }
}
