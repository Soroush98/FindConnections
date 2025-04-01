import { NextResponse } from 'next/server';
import { DynamoDBClient, ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { awsConfig, emailConfig, key} from '@/config';
import bcrypt from 'bcrypt';
import JWT from 'jsonwebtoken';
const SECRET_KEY = key.SECRET_KEY;
const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

export async function POST(request: Request) {
  const { Name, FamilyName, Email, Password } = await request.json();

  const params = {
    TableName: "FL_Users",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: {
      ":email": { S: Email },
    },
  };

  try {
    const { Items } = await client.send(new ScanCommand(params));
    if (Items && Items.length > 0) {
      return NextResponse.json(
        { message: 'Email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(Password, 10);
    const confirmationToken = JWT.sign({ email: Email, role: "user" }, SECRET_KEY);
    const tokenExpiration = Date.now() + 7200000; // 2 hours from now

    const maxIdParams = {
      TableName: "FL_Users",
      ProjectionExpression: "Id",
    };

    const { Items: idItems } = await client.send(new ScanCommand(maxIdParams));
    const maxId = idItems && idItems.length > 0 ? Math.max(...idItems.map(item => item.Id.S ? parseInt(item.Id.S) : 0)) : 0;
    const newUser = {
      Id: (maxId + 1).toString(),
      Name: Name,
      FamilyName: FamilyName,
      Email: Email,
      Password: hashedPassword,
      confirmationToken: confirmationToken.toString(),
      tokenExpiration: tokenExpiration,
      isConfirmed: false,
      uploadCount: 0,
      lastUploadDate: " ",
      notification_enabled: 0,
    };

    const putParams = {
      TableName: "FL_Users",
      Item: {
      Id: { S: newUser.Id },
      Name: { S: newUser.Name },
      FamilyName: { S: newUser.FamilyName },
      Email: { S: newUser.Email },
      Password: { S: newUser.Password },
      confirmationToken: { S: newUser.confirmationToken },
      tokenExpiration: { N: newUser.tokenExpiration.toString() },
      isConfirmed: { BOOL: newUser.isConfirmed },
      uploadCount: { N: newUser.uploadCount.toString() },
      lastUploadDate: { S: newUser.lastUploadDate },
      notification_enabled: { N: newUser.notification_enabled.toString() },
      },
    };
    await client.send(new PutItemCommand(putParams));
    // Call the send-confirmation API
    const res = await fetch(`${emailConfig.baseUrl}/api/users/send-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token : confirmationToken }),
    });
    if (res.ok) {
      return NextResponse.json(
        { 
          message: 'Registration successful. Please check your email for confirmation.',
          token: confirmationToken
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
  } catch (error) {
    console.error("DynamoDB error:", error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}