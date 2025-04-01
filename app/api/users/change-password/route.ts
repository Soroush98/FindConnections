import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import AWS, { AWSError } from 'aws-sdk';
import { awsConfig, key } from '@/config';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
// Import helper function
import { isStrongPassword } from "@/helpers/userHelpers";

AWS.config.update({
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  region: awsConfig.region,
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const SECRET_KEY = key.SECRET_KEY;

async function getUserById(userId: string) {
  const params = {
    TableName: "FL_Users",
    Key: { Id: userId },
  };

  const result = await dynamoDb.get(params).promise();
  return result.Item;
}

async function updateUserPassword(userId: string, hashedPassword: string) {
  const params = {
    TableName: "FL_Users",
    Key: { Id: userId },
    UpdateExpression: 'set Password = :password',
    ExpressionAttributeValues: {
      ':password': hashedPassword,
    },
  };

  await dynamoDb.update(params).promise();
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const { currentPassword, newPassword } = await req.json();
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { email: string, id: string, role: string };
    if (decoded.role !== 'user') {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }
    const user = await getUserById(decoded.id);

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const isPasswordMatch = await bcrypt.compare(currentPassword, user.Password);

    if (!isPasswordMatch) {
      return NextResponse.json({ message: 'Current password is incorrect' }, { status: 401 });
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json({ message: 'Password is too weak.' }, { status: 400 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(decoded.id, hashedNewPassword);

    return NextResponse.json({ message: 'Password changed successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json({ message: 'Token expired' }, { status: 401 });
    }
    if ((error as AWSError).code === 'ValidationException') {
      return NextResponse.json({ message: 'Validation error' }, { status: 400 });
    }
    
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
