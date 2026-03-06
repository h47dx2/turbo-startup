import { NextRequest, NextResponse } from "next/server";
import { clearAccessTokenCookie } from "@/lib/auth/cookies";
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
    path: "/auth/logout",
    body: {},
    headers: {
      "x-csrf-token": csrfResolution.token,
      cookie: csrfResolution.cookieHeader
    }
  });

  const payload = await apiResponse.json();
  const response = NextResponse.json(payload, { status: apiResponse.status });
  if (csrfResolution.bootstrapResponse) {
    forwardSetCookieHeaders(csrfResolution.bootstrapResponse, response);
  }
  forwardSetCookieHeaders(apiResponse, response);

  await clearAccessTokenCookie();

  return response;
}
