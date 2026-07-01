import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;
  const userRole = request.cookies.get('userRole')?.value;
  
  const path = request.nextUrl.pathname;
  
  // Protect routes based on role
  if (path.startsWith('/admin')) {
    if (!userId || userRole !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  if (path.startsWith('/teacher')) {
    if (!userId || (userRole !== 'GURU' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  
  if (path.startsWith('/student')) {
    if (!userId || userRole !== 'MURID') {
      return NextResponse.redirect(new URL('/', request.url));
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
  matcher: ['/', '/admin/:path*', '/teacher/:path*', '/student/:path*'],
};
