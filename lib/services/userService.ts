import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { userRepository, banRepository } from '@/lib/repositories';
import { jwtConfig } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { UserInfo } from '@/types/UserInfo';
import { isStrongPassword } from '@/helpers/userHelpers';

const SECRET_KEY = jwtConfig.secretKey;

export interface LoginResult {
  token: string;
  user: UserInfo;
}

export interface RegisterResult {
  userId: string;
  confirmationToken: string;
}

export interface UserPublicInfo {
  Id: string;
  Name: string;
  FamilyName: string;
  Email: string;
  isConfirmed: boolean;
  uploadCount: number;
  lastUploadDate: string;
  notification_enabled: number;
}

/**
 * User Service - handles user business logic
 */
export class UserService {
  /**
   * Authenticate user credentials and return JWT token
   */
  async login(email: string, password: string, ip: string): Promise<string> {
    // Check if IP is banned
    const banStatus = await banRepository.isIpBanned(ip);
    if (banStatus.banned) {
      throw AppError.banned('You are banned for an hour due to multiple incorrect login attempts.');
    }

    // Find user by email
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw AppError.validation('Invalid email or password. Please register if you do not have an account.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.Password);
    if (!isPasswordValid) {
      const attempts = await banRepository.incrementAttempts(ip);
      
      if (banRepository.hasExceededLimit(attempts)) {
        await banRepository.banIp(ip, email);
        throw AppError.banned('You are banned for an hour due to multiple incorrect login attempts.');
      }

      throw AppError.validation('The password you entered is not correct.');
    }

    // Reset ban status on successful login
    await banRepository.resetBan(ip);

    // Generate JWT token
    const token = jwt.sign(
      { email: user.Email, id: user.Id, role: 'user' },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    return token;
  }

  /**
   * Register a new user
   */
  async register(
    name: string,
    familyName: string,
    email: string,
    password: string
  ): Promise<RegisterResult> {
    // Check if email already exists
    const exists = await userRepository.emailExists(email);
    if (exists) {
      throw AppError.alreadyExists('Email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate confirmation token
    const confirmationToken = jwt.sign({ email, role: 'user' }, SECRET_KEY);
    const tokenExpiration = Date.now() + 7200000; // 2 hours

    // Create user
    const userId = await userRepository.create({
      name,
      familyName,
      email,
      hashedPassword,
      confirmationToken,
      tokenExpiration,
    });

    return { userId, confirmationToken };
  }

  /**
   * Get current user from auth token
   */
  async getCurrentUser(): Promise<UserPublicInfo> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      throw AppError.unauthorized();
    }

    const decoded = jwt.verify(token, SECRET_KEY) as { email: string; id: string; role: string };
    
    if (decoded.role !== 'user') {
      throw AppError.unauthorized();
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      throw AppError.notFound('User');
    }

    return {
      Id: user.Id,
      Name: user.Name,
      FamilyName: user.FamilyName,
      Email: user.Email,
      isConfirmed: user.isConfirmed,
      uploadCount: user.uploadCount,
      lastUploadDate: user.lastUploadDate,
      notification_enabled: user.notification_enabled || 0,
    };
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User');
    }

    // Verify current password
    const isPasswordMatch = await bcrypt.compare(currentPassword, user.Password);
    if (!isPasswordMatch) {
      throw AppError.validation('Current password is incorrect');
    }

    // Validate new password strength
    if (!isStrongPassword(newPassword)) {
      throw AppError.validation('Password is too weak.');
    }

    // Hash and update password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePassword(userId, hashedNewPassword);
  }

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(email: string): Promise<string> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw AppError.notFound('Email');
    }

    const token = jwt.sign({ email, role: 'user' }, SECRET_KEY);
    const expiration = Date.now() + 3600000; // 1 hour

    await userRepository.storeResetToken(user.Id, token, expiration);

    return token;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify token (throws if invalid)
    jwt.verify(token, SECRET_KEY);

    const user = await userRepository.findByResetToken(token);
    if (!user) {
      throw AppError.invalidToken('Invalid or expired reset token');
    }

    // Check if token is expired
    if (user.resetTokenExpiration && user.resetTokenExpiration < Date.now()) {
      throw AppError.tokenExpired('Reset token has expired');
    }

    // Validate new password
    if (!isStrongPassword(newPassword)) {
      throw AppError.validation('Password is too weak.');
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.updatePassword(user.Id, hashedPassword);

    // Clear reset token
    await userRepository.clearResetToken(user.Id);
  }

  /**
   * Confirm user email by token
   */
  async confirmEmail(token: string): Promise<void> {
    const user = await userRepository.findByConfirmationToken(token);
    if (!user) {
      throw AppError.invalidToken('Invalid confirmation token');
    }

    // Check if token is expired
    if (user.tokenExpiration && user.tokenExpiration < Date.now()) {
      throw AppError.tokenExpired('Confirmation token has expired');
    }

    await userRepository.confirmEmail(user.Id);
  }

  /**
   * Update user upload count
   */
  async updateUploadCount(userId: string, decrement: boolean = true): Promise<UserInfo | null> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User');
    }

    const today = new Date().toISOString().split('T')[0];
    let currentCount = user.uploadCount || 0;

    // Reset count if it's a new day
    if (user.lastUploadDate !== today) {
      currentCount = 10; // Max daily uploads
    }

    if (currentCount <= 0) {
      throw AppError.rateLimited('You have reached your maximum uploads for today. Please try again tomorrow.');
    }

    const newCount = decrement ? currentCount - 1 : currentCount;

    return userRepository.updateUploadCount({
      userId,
      newCount,
      date: today,
    });
  }

  /**
   * Update notification preference
   */
  async setNotificationPreference(userId: string, enabled: boolean): Promise<void> {
    await userRepository.updateNotificationPreference(userId, enabled);
  }

  /**
   * Verify auth token and extract user info
   */
  verifyToken(token: string): { email: string; id: string; role: string } {
    return jwt.verify(token, SECRET_KEY) as { email: string; id: string; role: string };
  }

  /**
   * Generate new confirmation token for user
   */
  async generateConfirmationToken(userId: string): Promise<string> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User');
    }

    const token = jwt.sign({ email: user.Email, role: 'user' }, SECRET_KEY);
    const expiration = Date.now() + 7200000; // 2 hours

    await userRepository.storeConfirmationToken(userId, token, expiration);

    return token;
  }
}

// Export singleton instance
export const userService = new UserService();
