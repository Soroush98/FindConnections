import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '@/config';
import jwt from 'jsonwebtoken';
import { key } from '@/config';
// Import helper functions
import { isStrongPassword, isValidEmail } from "@/helpers/userHelpers";

const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const SECRET_KEY = key.SECRET_KEY;
const dynamoDb = DynamoDBDocumentClient.from(client);

async function getUserByEmail(email: string) {
  const command = new ScanCommand({
    TableName: "FL_Users",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: {
      ":email": email,
    },
  });

  const result = await dynamoDb.send(command);
  return result.Items?.[0];
}
async function updateUserPassword(userId: string, hashedPassword: string) {
    const command = new UpdateCommand({
        TableName: "FL_Users",
        Key: { Id: userId },
        UpdateExpression: 'set Password = :password, resetToken = :null, resetTokenExpiration = :null',
        ExpressionAttributeValues: {
            ':password': hashedPassword,
            ':null': null,
        },
    });

    await dynamoDb.send(command);
}

// Removes ban for all IPs that match the user's email
async function removeBanByEmail(email: string) {
  const scanCommand = new ScanCommand({
    TableName: "FL_BannedIPs",
    FilterExpression: "bannedEmail = :userEmail",
    ExpressionAttributeValues: {
      ":userEmail": email,
    },
  });

  const scanResult = await dynamoDb.send(scanCommand);

  if (scanResult.Items) {
    for (const item of scanResult.Items) {
      const updateCommand = new UpdateCommand({
        TableName: "FL_BannedIPs",
        Key: { ip: item.ip },
        UpdateExpression: "REMOVE bannedUntil, bannedEmail SET attempts = :start, lastAttempt = :now",
        ExpressionAttributeValues: {
          ":start": 0,
          ":now": Date.now(),
        },
      });
      
      await dynamoDb.send(updateCommand);
    }
  }
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const { newPassword, token } = await req.json();
  const decodedToken = jwt.verify(token, SECRET_KEY) as {email: string, role: string};
  if (decodedToken.role !== 'user') {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
  }
  const email = decodedToken.email;

  if (!isValidEmail(email)) {
    return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
  }

  if (!isStrongPassword(newPassword)) {
    return NextResponse.json({ message: 'Password is too weak' }, { status: 400 });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user || user.resetToken !== token || user.resetTokenExpiration < Date.now()) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 400 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(user.Id, hashedNewPassword);

    await removeBanByEmail(email);

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
