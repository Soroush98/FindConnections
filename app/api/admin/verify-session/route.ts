import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { key } from '@/config';

const SECRET_KEY = key.SECRET_KEY;

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    // Verify the admin token
    const decoded = jwt.verify(token, SECRET_KEY) as { email: string, role: string };
    
    // Check if the user has admin role
    if (decoded.role !== 'admin') {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }

    // Return success response if token is valid and user is admin
    return NextResponse.json({ message: 'Authenticated', email: decoded.email }, { status: 200 });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }
    
    console.error('Error verifying admin session:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
