import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth-token";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await readSessionToken(token) : null;
  const { pathname } = request.nextUrl;

  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
