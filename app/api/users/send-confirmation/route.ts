import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { userService } from '@/lib/services';
import { userRepository } from '@/lib/repositories';
import { emailConfig } from '@/lib/env';
import { withErrorHandler, AppError } from '@/lib/errors';

async function sendConfirmationEmail(email: string, token: string) {
  const oAuth2Client = new google.auth.OAuth2(
    emailConfig.auth.clientId,
    emailConfig.auth.clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oAuth2Client.setCredentials({ refresh_token: emailConfig.auth.refreshToken });

  const accessToken = await oAuth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: emailConfig.auth.user,
      clientId: emailConfig.auth.clientId,
      clientSecret: emailConfig.auth.clientSecret,
      refreshToken: emailConfig.auth.refreshToken,
      accessToken: accessToken.token,
    },
  } as SMTPTransport.Options);

  const confirmationUrl = `${emailConfig.baseUrl}/confirm?token=${token}`;
  const mailOptions = {
    from: emailConfig.auth.user,
    to: email,
    subject: 'Email Confirmation',
    text: `Please confirm your email by clicking the following link. This link will expire in 2 hours: ${confirmationUrl}`,
  };

  await transporter.sendMail(mailOptions);
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const { token } = await req.json();

  const decodedToken = userService.verifyToken(token);
  if (decodedToken.role !== 'user') {
    throw AppError.forbidden();
  }

  const user = await userRepository.findByEmail(decodedToken.email);
  if (!user) {
    throw AppError.notFound('Email');
  }

  const newToken = await userService.generateConfirmationToken(user.Id);
  await sendConfirmationEmail(decodedToken.email, newToken);

  return NextResponse.json({ message: 'Confirmation email sent' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
