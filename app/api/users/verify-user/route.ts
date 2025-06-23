import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig, key } from '@/config';
import jwt from 'jsonwebtoken';
import { UserInfo } from '@/types/UserInfo';
import { cookies } from 'next/headers';

const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const documentClient = DynamoDBDocumentClient.from(client);

const SECRET_KEY = key.SECRET_KEY;

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { email: string, id: string, role: string };
    if (decoded.role!== 'user') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }    const command = new GetCommand({
      TableName: "FL_Users",
      Key: { Id: decoded.id }
    });

    const { Item } = await documentClient.send(command);
    const user: UserInfo | null = Item ? (Item as UserInfo) : null;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      Id: user.Id,
      Name: user.Name,
      FamilyName: user.FamilyName,
      Email: user.Email,
      isConfirmed: user.isConfirmed,
      uploadCount: user.uploadCount,
      lastUploadDate: user.lastUploadDate,
      notification_enabled: user.notification_enabled || 0,
      token: token
    });
  } catch (error){
    console.error('JWT verification error or DynamoDB error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
