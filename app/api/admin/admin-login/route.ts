import { NextRequest, NextResponse } from 'next/server';
import { DynamoDB } from 'aws-sdk';
import { awsConfig, key } from '@/config';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


const dynamoDb = new DynamoDB.DocumentClient({
  region: awsConfig.region,
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey
});

const SECRET_KEY = key.SECRET_KEY;

async function getAdminByEmail(email: string) {
  const params = {
    TableName: "FL_Admin",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: { ":email": email }
  };

  const result = await dynamoDb.scan(params).promise();
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
    response.headers.set('Set-Cookie', `admin-token=${token}; HttpOnly; Secure; Max-Age=${60 * 60 * 8}; Path=/; SameSite=Strict`);
    return response;

  } catch (error) {
    console.error('Error during admin login:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
