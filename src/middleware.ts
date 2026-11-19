import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Allow login and setup pages to prevent redirect loops
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/setup") {
    return NextResponse.next();
  }

  // Check for session_token cookie (Better Auth default)
  const sessionToken = request.cookies.get("session_token") ||
    request.cookies.get("__Secure-session_token") ||
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  // Protect dashboard routes
  const isDashboardRoute = 
    request.nextUrl.pathname.startsWith("/overview") ||
    request.nextUrl.pathname.startsWith("/guests") ||
    request.nextUrl.pathname.startsWith("/budget") ||
    request.nextUrl.pathname.startsWith("/tasks") ||
    request.nextUrl.pathname.startsWith("/seating");

  if (isDashboardRoute && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/overview", 
    "/login", 
    "/setup", 
    "/guests/:path*", 
    "/budget/:path*", 
    "/tasks/:path*", 
    "/seating/:path*"
  ],
};
