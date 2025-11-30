import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { userService } from '@/lib/services';
import { emailConfig } from '@/lib/env';
import { withErrorHandler, AppError } from '@/lib/errors';

async function sendResetEmail(email: string, token: string) {
  const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    auth: {
      type: 'OAuth2',
      user: emailConfig.auth.user,
      clientId: emailConfig.auth.clientId,
      clientSecret: emailConfig.auth.clientSecret,
      refreshToken: emailConfig.auth.refreshToken,
    },
  });

  const resetLink = `${emailConfig.baseUrl}/reset-password?token=${token}`;

  const mailOptions = {
    from: emailConfig.auth.user,
    to: email,
    subject: 'Password Reset Confirmation',
    text: `Please click the link below to reset your password. This link will expire in one hour:\n\n${resetLink}`,
  };

  await transporter.sendMail(mailOptions);
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const { Email } = await req.json();

  if (!Email || typeof Email !== 'string' || !Email.includes('@')) {
    throw AppError.validation('Invalid email');
  }

  const token = await userService.forgotPassword(Email);
  await sendResetEmail(Email, token);

  return NextResponse.json({ message: 'Confirmation email sent' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
