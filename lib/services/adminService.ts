import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { adminRepository } from '@/lib/repositories';
import { jwtConfig } from '@/lib/env';
import { AppError } from '@/lib/errors';

const SECRET_KEY = jwtConfig.secretKey;

/**
 * Admin Service - handles admin authentication and authorization
 */
export class AdminService {
  /**
   * Authenticate admin and return JWT token
   */
  async login(email: string, password: string): Promise<string> {
    const admin = await adminRepository.findByEmail(email);
    if (!admin) {
      throw AppError.validation('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.Password);
    if (!isPasswordValid) {
      throw AppError.validation('Invalid credentials');
    }

    // Generate JWT token with admin role
    const token = jwt.sign(
      { email: admin.Email, role: 'admin' },
      SECRET_KEY,
      { expiresIn: '8h' }
    );

    return token;
  }

  /**
   * Verify admin session from cookie
   */
  async verifySession(): Promise<{ email: string; role: string }> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (!token) {
      throw AppError.unauthorized();
    }

    const decoded = jwt.verify(token, SECRET_KEY) as { email: string; role: string };

    if (decoded.role !== 'admin') {
      throw AppError.forbidden();
    }

    return decoded;
  }

  /**
   * Verify admin token
   */
  verifyToken(token: string): { email: string; role: string } {
    const decoded = jwt.verify(token, SECRET_KEY) as { email: string; role: string };

    if (decoded.role !== 'admin') {
      throw AppError.forbidden();
    }

    return decoded;
  }
}

// Export singleton instance
export const adminService = new AdminService();
