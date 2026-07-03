import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// --- SECURITY GATEWAY (WAF Mini) ---
// Simple in-memory rate limiting (Per-Isolate)
const rateLimitMap = new Map<string, { count: number, timestamp: number }>();
const RATE_LIMIT_MAX = 50; // max requests
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || '';

  // 1. WAF: Anti-Scanner & Anti-Bot Protection
  const suspiciousBots = /sqlmap|nikto|nmap|burpsuite|postman|curl|wget|python-requests|java\/|go-http-client|ruby|php|acunetix|nessus|dirb|gobuster|hydra/i;
  if (suspiciousBots.test(userAgent) || userAgent.length === 0) {
    return new NextResponse('Security Gateway: Malicious User-Agent Detected. Request Dropped.', { status: 403 });
  }

  // 2. WAF: Rate Limiting (Anti-Bruteforce & DDoS Protection)
  const now = Date.now();
  const rateData = rateLimitMap.get(ip);
  if (!rateData || now - rateData.timestamp > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
  } else {
    if (rateData.count >= RATE_LIMIT_MAX) {
      return new NextResponse('Security Gateway: Rate Limit Exceeded. Incident Logged.', { 
        status: 429,
        headers: { 'Retry-After': '60' }
      });
    }
    rateData.count += 1;
  }
  // --- END SECURITY GATEWAY ---

  const session = request.cookies.get('session')?.value;
  let userId = null;
  let userRole = null;

  if (session) {
    const payload = await verifyToken(session);
    if (payload) {
      userId = payload.userId as string;
      userRole = payload.userRole as string;
    }
  }
  
  const path = request.nextUrl.pathname;
  
  // Protect routes based on role
  if (path.startsWith('/admin')) {
    if (!userId) return NextResponse.redirect(new URL('/', request.url));
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }
  
  if (path.startsWith('/teacher')) {
    if (!userId) return NextResponse.redirect(new URL('/', request.url));
    if (userRole !== 'GURU') {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }
  
  if (path.startsWith('/student')) {
    if (!userId) return NextResponse.redirect(new URL('/', request.url));
    if (userRole !== 'MURID') {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  // Protect /manage route (Teacher and Admin can access)
  if (path.startsWith('/manage')) {
    if (!userId) return NextResponse.redirect(new URL('/', request.url));
    if (userRole !== 'GURU' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  // Prevent logged-in users from seeing the login page
  if (path === '/' && userId && userRole) {
    if (userRole === 'SUPER_ADMIN') return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    if (userRole === 'GURU') return NextResponse.redirect(new URL('/teacher/dashboard', request.url));
    if (userRole === 'MURID') return NextResponse.redirect(new URL('/student/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
