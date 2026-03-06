import type { AuthSuccessResponse } from "@repo/validation";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/constants";
import { resolveCsrfForApiRequest } from "@/lib/auth/csrf";
import { clearAccessTokenCookie, setAccessTokenCookie } from "@/lib/auth/cookies";
import { createServerApiClient, forwardSetCookieHeaders } from "@/lib/api/proxy";

async function fetchMe(request: NextRequest, accessToken: string) {
  const apiClient = createServerApiClient(request, accessToken);
  return apiClient.rawRequest({
    method: "GET",
    path: "/auth/me"
  });
}

async function tryRefresh(request: NextRequest) {
  const csrfResolution = await resolveCsrfForApiRequest(request);
  if (!csrfResolution.ok) {
    return {
      ok: false as const,
      response: csrfResolution.response,
      payload: csrfResolution.payload,
      bootstrapResponse: csrfResolution.response
    };
  }

  const apiClient = createServerApiClient(request);
  const response = await apiClient.rawRequest({
    method: "POST",
    path: "/auth/refresh",
    body: {},
    headers: {
      "x-csrf-token": csrfResolution.token,
      cookie: csrfResolution.cookieHeader
    }
  });

  const payload = await response.json();
  return {
    ok: true as const,
    response,
    payload,
    bootstrapResponse: csrfResolution.bootstrapResponse
  };
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

  if (!accessToken) {
    const refreshAttempt = await tryRefresh(request);
    const refreshStatus = refreshAttempt.response.ok
      ? refreshAttempt.response.status
      : refreshAttempt.response.status === 400
        ? 401
        : refreshAttempt.response.status;
    const unauthorizedResponse = NextResponse.json(refreshAttempt.payload, { status: refreshStatus });

    if (refreshAttempt.bootstrapResponse) {
      forwardSetCookieHeaders(refreshAttempt.bootstrapResponse, unauthorizedResponse);
    }
    forwardSetCookieHeaders(refreshAttempt.response, unauthorizedResponse);

    if (!refreshAttempt.response.ok) {
      await clearAccessTokenCookie();
      return unauthorizedResponse;
    }

    const authPayload = refreshAttempt.payload as AuthSuccessResponse;
    accessToken = authPayload.token.accessToken;
    await setAccessTokenCookie(authPayload.token.accessToken, authPayload.token.expiresInSeconds);
  }

  let meResponse = await fetchMe(request, accessToken);

  if (meResponse.status === 401) {
    const refreshAttempt = await tryRefresh(request);

    if (!refreshAttempt.response.ok) {
      const refreshStatus = refreshAttempt.response.status === 400 ? 401 : refreshAttempt.response.status;
      const failedResponse = NextResponse.json(refreshAttempt.payload, { status: refreshStatus });
      if (refreshAttempt.bootstrapResponse) {
        forwardSetCookieHeaders(refreshAttempt.bootstrapResponse, failedResponse);
      }
      forwardSetCookieHeaders(refreshAttempt.response, failedResponse);
      await clearAccessTokenCookie();
      return failedResponse;
    }

    const authPayload = refreshAttempt.payload as AuthSuccessResponse;
    await setAccessTokenCookie(authPayload.token.accessToken, authPayload.token.expiresInSeconds);
    meResponse = await fetchMe(request, authPayload.token.accessToken);

    const mePayload = await meResponse.json();
    const response = NextResponse.json(mePayload, { status: meResponse.status });
    if (refreshAttempt.bootstrapResponse) {
      forwardSetCookieHeaders(refreshAttempt.bootstrapResponse, response);
    }
    forwardSetCookieHeaders(refreshAttempt.response, response);
    return response;
  }

  const payload = await meResponse.json();
  return NextResponse.json(payload, { status: meResponse.status });
}
