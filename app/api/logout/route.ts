import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  // Clear the session cookie
  const response = NextResponse.json({ message: 'Logged out' });
  response.headers.set('Set-Cookie', serialize('session', '', {
    httpOnly: true,
    maxAge: -1, // Expire the cookie
    path: '/',
  }));

  return response;
}