import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { userService } from '@/lib/services';
import { userRepository } from '@/lib/repositories';
import { dynamoDb } from '@/lib/db';
import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { withErrorHandler, AppError } from '@/lib/errors';
import { isStrongPassword, isValidEmail } from '@/helpers/userHelpers';

// Removes ban for all IPs that match the user's email
async function removeBanByEmail(email: string) {
  const scanCommand = new ScanCommand({
    TableName: 'FL_BannedIPs',
    FilterExpression: 'bannedEmail = :userEmail',
    ExpressionAttributeValues: {
      ':userEmail': email,
    },
  });

  const scanResult = await dynamoDb.send(scanCommand);

  if (scanResult.Items) {
    for (const item of scanResult.Items) {
      const updateCommand = new UpdateCommand({
        TableName: 'FL_BannedIPs',
        Key: { ip: item.ip },
        UpdateExpression: 'REMOVE bannedUntil, bannedEmail SET attempts = :start, lastAttempt = :now',
        ExpressionAttributeValues: {
          ':start': 0,
          ':now': Date.now(),
        },
      });

      await dynamoDb.send(updateCommand);
    }
  }
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const { newPassword, token } = await req.json();

  const decodedToken = userService.verifyToken(token);
  if (decodedToken.role !== 'user') {
    throw AppError.forbidden();
  }

  const email = decodedToken.email;

  if (!isValidEmail(email)) {
    throw AppError.validation('Invalid email format');
  }

  if (!isStrongPassword(newPassword)) {
    throw AppError.validation('Password is too weak');
  }

  const user = await userRepository.findByEmail(email);
  if (!user || user.resetToken !== token || (user.resetTokenExpiration && user.resetTokenExpiration < Date.now())) {
    throw AppError.invalidToken('Invalid or expired token');
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await userRepository.updatePassword(user.Id, hashedNewPassword);
  await userRepository.clearResetToken(user.Id);

  await removeBanByEmail(email);

  return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
