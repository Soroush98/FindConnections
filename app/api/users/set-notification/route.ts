import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig, key } from '@/config';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const dynamoDb = DynamoDBDocumentClient.from(client);
const SECRET_KEY = key.SECRET_KEY;

async function updateUserNotification(userId: string, enabled: boolean) {
  const command = new UpdateCommand({
    TableName: "FL_Users",
    Key: { "Id": userId },
    UpdateExpression: 'set notification_enabled = :enabled',
    ExpressionAttributeValues: {
      ':enabled': enabled ? 1 : 0,
    },
  });

  await dynamoDb.send(command);
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const { enabled } = await req.json();
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { id: string, email: string, role: string };
    if (decoded.role !== 'user') {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }
    await updateUserNotification(decoded.id, enabled);

    return NextResponse.json({ message: 'Notification preference updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating notification preference:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
