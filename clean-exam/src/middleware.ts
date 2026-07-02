import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
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
    if (userRole !== 'GURU' && userRole !== 'SUPER_ADMIN') {
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
  matcher: ['/', '/admin/:path*', '/teacher/:path*', '/student/:path*', '/manage/:path*'],
};
