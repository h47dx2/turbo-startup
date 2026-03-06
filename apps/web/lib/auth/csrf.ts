import type { NextRequest } from "next/server";
import { CSRF_TOKEN_COOKIE_NAME } from "./constants";
import { createServerApiClient } from "../api/proxy";

type CsrfResolutionSuccess = {
  ok: true;
  token: string;
  cookieHeader: string;
  bootstrapResponse: Response | null;
};

type CsrfResolutionError = {
  ok: false;
  response: Response;
  payload: unknown;
};

export type CsrfResolution = CsrfResolutionSuccess | CsrfResolutionError;

function appendCookie(existingCookieHeader: string | null, name: string, value: string) {
  if (!existingCookieHeader || existingCookieHeader.trim().length === 0) {
    return `${name}=${value}`;
  }

  const cookiePattern = new RegExp(`(?:^|;\\s*)${name}=`);
  if (cookiePattern.test(existingCookieHeader)) {
    return existingCookieHeader;
  }

  return `${existingCookieHeader}; ${name}=${value}`;
}

export async function resolveCsrfForApiRequest(request: NextRequest): Promise<CsrfResolution> {
  const incomingCookieHeader = request.headers.get("cookie");
  const csrfFromCookie = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;

  if (csrfFromCookie) {
    return {
      ok: true,
      token: csrfFromCookie,
      cookieHeader: appendCookie(incomingCookieHeader, CSRF_TOKEN_COOKIE_NAME, csrfFromCookie),
      bootstrapResponse: null
    };
  }

  const apiClient = createServerApiClient(request);
  const bootstrapResponse = await apiClient.rawRequest({
    method: "GET",
    path: "/auth/csrf"
  });

  const payload = await bootstrapResponse.json();

  if (!bootstrapResponse.ok) {
    return {
      ok: false,
      response: bootstrapResponse,
      payload
    };
  }

  const csrfToken =
    typeof payload === "object" && payload && "csrfToken" in payload && typeof payload.csrfToken === "string"
      ? payload.csrfToken
      : "";

  if (!csrfToken) {
    return {
      ok: false,
      response: bootstrapResponse,
      payload: {
        error: {
          code: "bad_csrf_bootstrap_response",
          message: "Invalid CSRF bootstrap response"
        }
      }
    };
  }

  return {
    ok: true,
    token: csrfToken,
    cookieHeader: appendCookie(incomingCookieHeader, CSRF_TOKEN_COOKIE_NAME, csrfToken),
    bootstrapResponse
  };
}
