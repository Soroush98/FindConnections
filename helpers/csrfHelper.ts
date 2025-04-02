import { NextRequest } from 'next/server';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { key } from '@/config';

const CSRF_SECRET = key.SECRET_KEY; // Ideally use a separate secret for CSRF

/**
 * Validates a CSRF token against the one stored in cookies
 * @param request The Next.js request object
 * @param providedToken The token provided in headers 
 * @returns Boolean indicating if token is valid
 */
export async function validateCsrfToken(request: NextRequest, providedToken: string): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;
  
  const cookies = parse(cookieHeader);
  const storedToken = cookies['csrf-token'];
  
  if (!storedToken) return false;
  
  try {
    // Verify and decode the signed token from cookie
    const decoded = jwt.verify(storedToken, CSRF_SECRET) as { token: string, expires: number };
    
    // Check if token has expired
    if (Date.now() > decoded.expires) return false;
    
    // Compare provided token with the one in cookie
    return decoded.token === providedToken;
  } catch {
    return false;
  }
}

/**
 * Extracts CSRF token from request headers 
 * @param req The Next.js request object
 * @returns The extracted token or empty string
 */
export async function extractCsrfToken(req: NextRequest) {
  // Check header first
  const headerToken = req.headers.get('X-CSRF-Token');
  if (headerToken) return headerToken;
}
