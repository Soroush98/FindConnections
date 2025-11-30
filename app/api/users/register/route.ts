import { NextResponse } from 'next/server';
import { userService } from '@/lib/services';
import { emailConfig } from '@/lib/env';
import { withErrorHandler } from '@/lib/errors';

async function handler(request: Request): Promise<NextResponse> {
  const { Name, FamilyName, Email, Password } = await request.json();

  const { confirmationToken } = await userService.register(Name, FamilyName, Email, Password);

  // Call the send-confirmation API
  const res = await fetch(`${emailConfig.baseUrl}/api/users/send-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: confirmationToken }),
  });

  if (res.ok) {
    return NextResponse.json(
      {
        message: 'Registration successful. Please check your email for confirmation.',
        token: confirmationToken,
      },
      { status: 200 }
    );
  } else {
    const data = await res.json();
    return NextResponse.json(
      { error: data.message || 'Failed to send confirmation email. Please try again later.' },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandler(handler);