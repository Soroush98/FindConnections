import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logout successful' });
  response.cookies.set('auth-token', '', { httpOnly: true, path: '/', expires: new Date(0) }); // Remove the cookie
  return response;
}
