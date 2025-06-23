import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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

const dynamoDb = DynamoDBDocumentClient.from(client);

const SECRET_KEY = key.SECRET_KEY;

async function getAdminByEmail(email: string) {
  const params = {
    TableName: "FL_Admin",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: { ":email": email }
  };

  const result = await dynamoDb.send(new ScanCommand(params));
  return result.Items?.[0] || null;
}

export async function GET(req: NextRequest) {
  try {
    
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const password = searchParams.get('password');
    
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    const admin = await getAdminByEmail(email);
    
    if (!admin) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.Password);
    
    if (!isPasswordValid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Generate JWT token with admin role
    const token = jwt.sign(
      { email: admin.Email, role: 'admin' },
      SECRET_KEY,
      { expiresIn: '8h' } // 8 hour expiration for admin sessions
    );

    // Set HTTP-only secure cookie
    const response = NextResponse.json({ message: 'Login successful' }, { status: 200 });
    response.cookies.set({
      name: 'admin-token',
      value: token,
      httpOnly: true,
      secure: false, // Use secure cookies in production
      maxAge: 60 * 60 * 8, // 8 hours in seconds
      path: '/',
      sameSite: 'strict'
    });
    return response;

  } catch (error) {
    console.error('Error during admin login:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
