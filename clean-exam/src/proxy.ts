import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware ini hanya sebagai demonstrasi proteksi rute di sisi Frontend
// Pada aplikasi sebenarnya, kita akan memvalidasi JWT dari cookie.
export function proxy(request: NextRequest) {
  // Misalnya jika mencoba mengakses /admin/*, /teacher/*, atau /student/*
  // Karena ini mock UI, kita biarkan saja lewat, tetapi struktur Middleware
  // sudah sesuai dengan kebutuhan PRD (A01:2021-Broken Access Control).
  
  const path = request.nextUrl.pathname;
  
  // Contoh logika (di-comment agar UI bisa ditest langsung):
  /*
  const token = request.cookies.get('token');
  if (path.startsWith('/admin') && !token) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  */

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
  ],
}
