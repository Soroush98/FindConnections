import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { key } from '@/config';
import { awsConfig, emailConfig } from '@/config';

const SECRET_KEY = key.SECRET_KEY;

AWS.config.update({
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  region: awsConfig.region,
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

async function getUserByEmail(email: string) {
  const params = {
    TableName: "FL_Users",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: {
      ":email": email,
    },
  };

  const result = await dynamoDb.scan(params).promise();
  return result.Items?.[0];
}
async function storeResetToken(email: string, token: string, expiration: number) {
    const user = await getUserByEmail(email);
    if (!user) {
        throw new Error('User not found');
    }

    const params = {
        TableName: "FL_Users",
        Key: { Id: user.Id },
        UpdateExpression: 'set resetToken = :token, resetTokenExpiration = :expiration',
        ExpressionAttributeValues: {
            ':token': token,
            ':expiration': expiration,
        },
    };

    await dynamoDb.update(params).promise();
}

async function sendConfirmationEmail(email: string, token: string) {
  const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    auth: {
      type: 'OAuth2',
      user: emailConfig.auth.user,
      clientId: emailConfig.auth.clientId,
      clientSecret: emailConfig.auth.clientSecret,
      refreshToken: emailConfig.auth.refreshToken,
    },
  });

const resetLink = `${emailConfig.baseUrl}/reset-password?token=${token}`;

const mailOptions = {
    from: emailConfig.auth.user,
    to: email,
    subject: 'Password Reset Confirmation',
    text: `Please click the link below to reset your password. This link will expire in one hour:\n\n${resetLink}`,
};

  await transporter.sendMail(mailOptions);
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const { Email } = await req.json();

  if (!Email || typeof Email !== 'string' || !Email.includes('@')) {
    return NextResponse.json({ message: 'Invalid email' }, { status: 400 });
  }

  try {
    const user = await getUserByEmail(Email);
    if (!user) {
      return NextResponse.json({ message: 'Email not found' }, { status: 404 });
    }

    const token = jwt.sign({ email: Email , role: "user"}, SECRET_KEY);
    const expiration = Date.now() + 3600000; // 1 hour from now

    await storeResetToken(Email, token, expiration);
    await sendConfirmationEmail(Email, token);

    return NextResponse.json({ message: 'Confirmation email sent' }, { status: 200 });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
