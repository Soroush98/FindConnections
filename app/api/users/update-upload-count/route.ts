import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '@/config';
import jwt from 'jsonwebtoken';
import { key } from '@/config';
import { cookies } from 'next/headers';

const ddbClient = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});
const dynamoDb = DynamoDBDocumentClient.from(ddbClient);
const SECRET_KEY = key.SECRET_KEY;

async function updateUserUploadCount(userId: string, uploadCount: number, lastUploadDate: string) {
  await dynamoDb.send(new UpdateCommand({
    TableName: "FL_Users",
    Key: { Id: userId },
    UpdateExpression: 'set uploadCount = :uploadCount, lastUploadDate = :lastUploadDate',
    ExpressionAttributeValues: {
      ':uploadCount': uploadCount,
      ':lastUploadDate': lastUploadDate,
    },
  }));
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  let userId;
  try {
    const decoded = jwt.verify(token, SECRET_KEY) as { email: string, id: string, role: string };
    if (decoded.role !== 'user') { 
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
    }
    userId = decoded.id;
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const { uploadCount, lastUploadDate } = await req.json();

  if ( uploadCount === undefined || !lastUploadDate) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }

  try {
    await updateUserUploadCount(userId, uploadCount, lastUploadDate);
    return NextResponse.json({ message: 'Upload count updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating upload count:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}