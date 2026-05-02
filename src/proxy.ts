// ============================================================
// Next.js proxy — runs on every request
// 1. Refreshes Supabase auth tokens automatically
// 2. Adds caching headers for static assets
// 3. Adds security headers
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  // Call the original auth middleware
  const response = await updateSession(request);

  // Add caching headers for static assets
  if (
    request.nextUrl.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|eot)$/)
  ) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Cache API GET routes for 5 minutes
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    ['GET', 'HEAD'].includes(request.method)
  ) {
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  }

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and specific API routes
    '/((?!api/auth/login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
