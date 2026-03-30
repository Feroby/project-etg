import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const auth = req.cookies.get('etg_auth')?.value
  const { pathname } = req.nextUrl

  // Allow login page and auth API through
  if (pathname === '/login' || pathname.startsWith('/api/auth') || pathname.startsWith('/api/logout')) {
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (auth !== 'true') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
