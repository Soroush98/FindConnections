import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Clear the admin-token cookie by setting it to an empty string with immediate expiration
    cookieStore.set('admin-token', '', {
      expires: new Date(0), 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict'
    });

    return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json({ message: 'Error during logout' }, { status: 500 });
  }
}
