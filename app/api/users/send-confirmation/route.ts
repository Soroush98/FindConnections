import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import nodemailer from 'nodemailer';
import { awsConfig, emailConfig, key } from '@/config';
import { google } from 'googleapis';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import JWT from 'jsonwebtoken';


const SECRET_KEY = key.SECRET_KEY;

const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

async function getUserByEmail(userEmail: string) {
  const params = {
    TableName: "FL_Users",
    FilterExpression: "Email = :email",
    ExpressionAttributeValues: {
      ":email": { S: userEmail },
    },
  };

  const result = await client.send(new ScanCommand(params));
  return result.Items?.[0];
}

async function updateConfirmationToken(userId: string, token: string, expiration: number) {
  const params = {
    TableName: "FL_Users",
    Key: { Id: { S: userId } },
    UpdateExpression: 'set confirmationToken = :token, tokenExpiration = :expiration',
    ExpressionAttributeValues: {
      ':token': { S: token },
      ':expiration': { N: expiration.toString() },
    },
  };

  await client.send(new UpdateItemCommand(params));
}
async function sendConfirmationEmail(email: string, token: string) {
  const oAuth2Client = new google.auth.OAuth2(
    emailConfig.auth.clientId,
    emailConfig.auth.clientSecret,
    'https://developers.google.com/oauthplayground'
  );
  oAuth2Client.setCredentials({ refresh_token: emailConfig.auth.refreshToken });

  const accessToken = await oAuth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: emailConfig.auth.user,
      clientId: emailConfig.auth.clientId,
      clientSecret: emailConfig.auth.clientSecret,
      refreshToken: emailConfig.auth.refreshToken,
      accessToken: accessToken.token,
    },
  } as SMTPTransport.Options);
  

  const confirmationUrl = `${emailConfig.baseUrl}/confirm?token=${token}`;
  const mailOptions = {
    from: emailConfig.auth.user,
    to: email,
    subject: 'Email Confirmation',
    text: `Please confirm your email by clicking the following link. This link will expire in 2 hours: ${confirmationUrl}`,
  };

  await transporter.sendMail(mailOptions);
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
  }

  const { token } = await req.json();
  const decodedToken = JWT.verify(token, SECRET_KEY) as { email: string, role: string };
  if (decodedToken.role != 'user') {
    return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
  }
  try {
    const user = await getUserByEmail(decodedToken.email);
    if (!user) {
      return NextResponse.json({ message: 'Email not found' }, { status: 404 });
    }
    const token = JWT.sign({ email: decodedToken.email , role: "user" }, SECRET_KEY);
    const expiration = Date.now() + 7200000; // 2 hours from now

    if (!user.Id.S) {
      throw new Error('User ID is undefined');
    }
    await updateConfirmationToken(user.Id.S , token, expiration);
    await sendConfirmationEmail(decodedToken.email, token);

    return NextResponse.json({ message: 'Confirmation email sent' }, { status: 200 });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
