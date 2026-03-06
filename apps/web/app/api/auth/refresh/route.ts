import type { AuthSuccessResponse } from "@repo/validation";
import { NextRequest, NextResponse } from "next/server";
import { clearAccessTokenCookie, setAccessTokenCookie } from "@/lib/auth/cookies";
import { resolveCsrfForApiRequest } from "@/lib/auth/csrf";
import { createServerApiClient, forwardSetCookieHeaders } from "@/lib/api/proxy";

export async function POST(request: NextRequest) {
  const csrfResolution = await resolveCsrfForApiRequest(request);
  if (!csrfResolution.ok) {
    const response = NextResponse.json(csrfResolution.payload, { status: csrfResolution.response.status });
    forwardSetCookieHeaders(csrfResolution.response, response);
    await clearAccessTokenCookie();
    return response;
  }

  const apiClient = createServerApiClient(request);
  const apiResponse = await apiClient.rawRequest({
    method: "POST",
    path: "/auth/refresh",
    body: {},
    headers: {
      "x-csrf-token": csrfResolution.token,
      cookie: csrfResolution.cookieHeader
    }
  });

  const payload = await apiResponse.json();
  const responsePayload = apiResponse.ok
    ? {
        user: (payload as AuthSuccessResponse).user,
        token: {
          tokenType: (payload as AuthSuccessResponse).token.tokenType,
          expiresInSeconds: (payload as AuthSuccessResponse).token.expiresInSeconds
        }
      }
    : payload;
  const response = NextResponse.json(responsePayload, { status: apiResponse.status });
  if (csrfResolution.bootstrapResponse) {
    forwardSetCookieHeaders(csrfResolution.bootstrapResponse, response);
  }
  forwardSetCookieHeaders(apiResponse, response);

  if (apiResponse.ok) {
    const authPayload = payload as AuthSuccessResponse;
    await setAccessTokenCookie(authPayload.token.accessToken, authPayload.token.expiresInSeconds);
  } else {
    await clearAccessTokenCookie();
  }

  return response;
}
