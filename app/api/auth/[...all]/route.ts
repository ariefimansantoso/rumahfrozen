import { auth } from "@/lib/auth";
import { defaultLocale, isValidLocale } from "@/config/i18n.config";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse, type NextRequest } from "next/server";

const inner = toNextJsHandler(auth);

function extractSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === "function") {
    return (getSetCookie as unknown as (this: Headers) => string[]).call(
      headers,
    );
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function getOAuthStateCookieValue(request: NextRequest): string | undefined {
  const cookies = request.cookies.getAll();
  const direct =
    cookies.find((c) => c.name.endsWith("better-auth.oauth_state"))?.value ||
    cookies.find((c) => c.name.endsWith("better-auth.state"))?.value;
  return direct;
}

async function getOAuthErrorRedirectBaseURL(
  request: NextRequest,
): Promise<string> {
  const stateCookie = getOAuthStateCookieValue(request);
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!stateCookie || !secret) return "";

  try {
    const { symmetricDecrypt } =
      (await import("better-auth/crypto")) as unknown as {
        symmetricDecrypt: (args: {
          key: string;
          data: string;
        }) => Promise<string>;
      };
    const decrypted = await symmetricDecrypt({
      key: secret,
      data: stateCookie,
    });
    const parsed = JSON.parse(decrypted) as { errorURL?: string };
    return typeof parsed?.errorURL === "string" ? parsed.errorURL : "";
  } catch {
    return "";
  }
}

function fallbackErrorURL(request: NextRequest): string {
  const rawLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const locale =
    rawLocale && isValidLocale(rawLocale) ? rawLocale : defaultLocale;
  return `/${locale}/login`;
}

async function redirectOAuthCallbackErrors(
  request: NextRequest,
  response: Response,
): Promise<Response> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/auth/callback/")) return response;
  if (response.ok) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return response;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }

  const code =
    typeof body === "object" && body !== null && "code" in body
      ? String((body as { code: unknown }).code)
      : "";
  if (
    code !== "OAUTH_SIGNIN_IS_ONLY_AVAILABLE_FOR_CUSTOMERS" &&
    code !== "OAUTH_ACCOUNT_ROLE_CONFLICT"
  ) {
    return response;
  }

  const baseErrorURL =
    (await getOAuthErrorRedirectBaseURL(request)) || fallbackErrorURL(request);
  const redirectURL = new URL(baseErrorURL, request.url);

  if (code === "OAUTH_ACCOUNT_ROLE_CONFLICT") {
    redirectURL.searchParams.set("error", "oauth_account_role_conflict");
    const role =
      typeof body === "object" && body !== null && "role" in body
        ? String((body as { role: unknown }).role)
        : "";
    const email =
      typeof body === "object" && body !== null && "email" in body
        ? String((body as { email: unknown }).email)
        : "";
    if (role) redirectURL.searchParams.set("role", role);
    if (email) redirectURL.searchParams.set("email", email);
  } else {
    redirectURL.searchParams.set("error", "oauth_customer_only");
  }

  const redirectResponse = NextResponse.redirect(redirectURL, 303);
  for (const setCookie of extractSetCookieHeaders(response.headers)) {
    redirectResponse.headers.append("set-cookie", setCookie);
  }
  redirectResponse.headers.set("cache-control", "no-store");
  return redirectResponse;
}

export async function GET(request: NextRequest): Promise<Response> {
  const response = await inner.GET(request);
  return redirectOAuthCallbackErrors(request, response);
}

export async function POST(request: NextRequest): Promise<Response> {
  const response = await inner.POST(request);
  return redirectOAuthCallbackErrors(request, response);
}
