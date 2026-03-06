import type { AuthSuccessResponse } from "@repo/validation";
import { NextRequest, NextResponse } from "next/server";
import { setAccessTokenCookie } from "@/lib/auth/cookies";
import { createServerApiClient, forwardSetCookieHeaders } from "@/lib/api/proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const apiClient = createServerApiClient(request);
  const apiResponse = await apiClient.rawRequest({
    method: "POST",
    path: "/auth/register",
    body
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
  forwardSetCookieHeaders(apiResponse, response);

  if (apiResponse.ok) {
    const authPayload = payload as AuthSuccessResponse;
    await setAccessTokenCookie(authPayload.token.accessToken, authPayload.token.expiresInSeconds);
  }

  return response;
}
