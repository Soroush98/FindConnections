import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig, key } from '@/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const documentClient = DynamoDBDocumentClient.from(client);

const SECRET_KEY = key.SECRET_KEY;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const BAN_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

async function getIpBanStatus(ip: string) {
  const command = new GetCommand({
    TableName: "FL_BannedIPs",
    Key: { ip },
  });

  const result = await documentClient.send(command);
  return result.Item;
}

async function getAndIncrementLoginAttempts(ip: string) {
  // Get current attempt info
  const getCommand = new GetCommand({
    TableName: "FL_BannedIPs",
    Key: { ip },
  });
  const oldData = await documentClient.send(getCommand);
  let oldAttempts = oldData.Item?.attempts || 0;
  const oldLastAttempt = oldData.Item?.lastAttempt || 0;

  // Reset if more than 1 minute has passed
  const now = Date.now();
  if ((now - oldLastAttempt) > ATTEMPT_WINDOW) {
    oldAttempts = 0;
  }

  const newAttempts = oldAttempts + 1;
  // Update in DB
  const updateCommand = new UpdateCommand({
    TableName: "FL_BannedIPs",
    Key: { ip },
    UpdateExpression: "SET attempts = :a, lastAttempt = :t",
    ExpressionAttributeValues: {
      ":a": newAttempts,
      ":t": now,
    },
    ReturnValues: "UPDATED_NEW",
  });
  const result = await documentClient.send(updateCommand);

  return result.Attributes;
}


async function banIp(ip: string, userEmail: string) {
  const command = new UpdateCommand({
    TableName: "FL_BannedIPs",
    Key: { ip },
    UpdateExpression: "SET bannedUntil = :until, bannedEmail = :email",
    ExpressionAttributeValues: {
      ":until": Date.now() + BAN_DURATION,
      ":email": userEmail,
    },
  });
  await documentClient.send(command);
}

async function resetBan(ip: string) {
  const command = new UpdateCommand({
    TableName: "FL_BannedIPs",
    Key: { ip },
    UpdateExpression: "REMOVE bannedUntil, bannedEmail SET attempts = :start, lastAttempt = :now",
    ExpressionAttributeValues: {
      ":start": 0,
      ":now": Date.now(),
    },
  });
  await documentClient.send(command);
}

export async function POST(request: NextRequest) {
  const { Email, Password } = await request.json();
  // Prioritize Vercel's trusted header for secure IP detection
  const ip = request.headers.get('x-vercel-forwarded-for') || 
             request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             '127.0.0.1';

  if (!ip) {
    return NextResponse.json(
      { error: 'IP address not found' },
      { status: 400 }
    );
  }
  const banStatus = await getIpBanStatus(ip);
  if (banStatus && banStatus.bannedUntil) {
    if (banStatus.bannedUntil > Date.now()) {
      return NextResponse.json(
        { error: 'You are banned for an hour due to multiple incorrect login attempts.' },
        { status: 429 }
      );
    } else {
      // Ban expired; reset login attempts
      if (ip) {
        await resetBan(ip);
      }
    }
  }

  const params = {
    TableName: "FL_Users",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: { ":email": Email }
  };
  try {
    const command = new ScanCommand(params);
    const { Items } = await documentClient.send(command);
    const user = Items?.[0] || null;

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password. Please register if you do not have an account.' },
        { status: 404 }
      );
    } else if (!(await bcrypt.compare(Password, user.Password))) {
      const attempts = await getAndIncrementLoginAttempts(ip);
      if (attempts && attempts.attempts >= MAX_ATTEMPTS) {
        await banIp(ip, user.Email);
        return NextResponse.json(
          { error: 'You are banned for an hour due to multiple incorrect login attempts.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'The password you entered is not correct.' },
        { status: 401 }
      );
    }
    // Reset login attempts on successful login
    await resetBan(ip);

    // Generate a new JWT token
    const authToken = jwt.sign({ email: user.Email, id: user.Id , role: "user"}, SECRET_KEY, { expiresIn: '1h' });
    
    // Set cookie via NextResponse object
    const response = NextResponse.json({ message: 'Login successful' });
    response.cookies.set({
      name: 'auth-token',
      value: authToken,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day in seconds
      sameSite: 'strict',
      secure: false
    });
    
    return response;
    
  } catch (error) {
    console.error('DynamoDB error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
