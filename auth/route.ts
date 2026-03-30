import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const validUser = process.env.APP_USERNAME
  const validPass = process.env.APP_PASSWORD

  if (username === validUser && password === validPass) {
    const res = NextResponse.json({ success: true })
    res.cookies.set('etg_auth', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return res
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}
