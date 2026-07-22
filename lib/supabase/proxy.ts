import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isUserRole } from "@/lib/auth/types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/login";
  const isConfigurationRoute =
    pathname === "/configuracion" || pathname.startsWith("/configuracion/");
  const isProtectedRoute =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/asistente" ||
    pathname.startsWith("/asistente/") ||
    pathname === "/controles" ||
    pathname.startsWith("/controles/") ||
    isConfigurationRoute;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedRoute) {
      return redirectWithCookies(request, response, "/login");
    }

    return response;
  }

  if (isLoginRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile && isUserRole(profile.role)) {
      return redirectWithCookies(request, response, "/dashboard");
    }

    return response;
  }

  if (!isProtectedRoute) {
    return response;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile || !isUserRole(profile.role)) {
    return redirectWithCookies(request, response, "/login");
  }

  if (isConfigurationRoute && profile.role !== "ingeniero") {
    return redirectWithCookies(request, response, "/dashboard");
  }

  return response;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, path: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = path;
  redirectUrl.search = "";

  const redirectResponse = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}
