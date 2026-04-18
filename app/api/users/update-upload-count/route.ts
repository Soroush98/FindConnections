import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '@/config';
import jwt from 'jsonwebtoken';
import { key } from '@/config';
import { cookies } from 'next/headers';

const DAILY_UPLOAD_LIMIT = 10;

const ddbClient = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});
const dynamoDb = DynamoDBDocumentClient.from(ddbClient);
const SECRET_KEY = key.SECRET_KEY;

async function resetUserUploadCountIfNewDay(userId: string, today: string) {
  await dynamoDb.send(new UpdateCommand({
    TableName: 'FL_Users',
    Key: { Id: userId },
    UpdateExpression: 'set uploadCount = :limit, lastUploadDate = :today',
    ConditionExpression: 'attribute_not_exists(lastUploadDate) OR lastUploadDate <> :today',
    ExpressionAttributeValues: {
      ':limit': DAILY_UPLOAD_LIMIT,
      ':today': today,
    },
  }));
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { email: string; id: string; role: string };
    if (decoded.role !== 'user') {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }
    userId = decoded.id;
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    await resetUserUploadCountIfNewDay(userId, today);
    return NextResponse.json(
      { message: 'Upload count refreshed', uploadCount: DAILY_UPLOAD_LIMIT, lastUploadDate: today },
      { status: 200 }
    );
  } catch (error: unknown) {
    if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') {
      return NextResponse.json({ message: 'No reset needed' }, { status: 200 });
    }
    console.error('Error refreshing upload count:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
