import { defaultLocale, isLocale } from "@/shared/config/locales";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const firstSegment = pathname.split("/")[1];

  if (!isLocale(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAppRoute = pathname.match(/^\/(en|ru)\/app/);
  const isLoginRoute = pathname.match(/^\/(en|ru)\/login/);
  const isHomeRoute = pathname.match(/^\/(en|ru)\/?$/);

  if (!user && (isAppRoute || isHomeRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${firstSegment}/login`;
    return NextResponse.redirect(url);
  }

  if (user && (isLoginRoute || isHomeRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${firstSegment}/app`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
