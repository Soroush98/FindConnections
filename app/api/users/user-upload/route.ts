import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, ReturnValue } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { awsConfig } from '@/config';
import { parse } from 'cookie';
import {key} from '@/config';
import jwt from 'jsonwebtoken';

const SECRET_KEY = key.SECRET_KEY;
const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const dynamoClient = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

// Check if file already exists with either name combination
async function checkIfFileExists(firstPerson: string, secondPerson: string, fileExtension: string) {
  const key1 = `${firstPerson}_${secondPerson}.${fileExtension}`;
  const key2 = `${secondPerson}_${firstPerson}.${fileExtension}`;
  
  const params = {
    Bucket: awsConfig.tempbucketName,
    Prefix: '' // Search the entire bucket
  };
  
  const response = await s3Client.send(new ListObjectsV2Command(params));
  
  if (response.Contents) {
    for (const object of response.Contents) {
      if (object.Key === key1 || object.Key === key2) {
        return true; // File already exists
      }
    }
  }
  
  return false; // File does not exist
}

export async function POST(req: NextRequest) {
  // Extract token from cookie or header
  let token;
  const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const cookies = parse(cookieHeader);
      token = cookies['auth-token'];
    }

  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  let userId;
  try {
    // Verify token and extract user ID
    const decoded = jwt.verify(token, SECRET_KEY) as { id: string, email: string, role: string };
    if (decoded.role!=='user') {
      return NextResponse.json({ message: 'Not authorized' }, { status: 403 }); 
    }
    userId = decoded.id;
  } catch {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  // Get user info to check upload count
  const userParams = {
    TableName: 'FL_Users',
    Key: {
      'Id': { S: userId }
    }
  };

  try {
    const { Item } = await dynamoClient.send(new GetItemCommand(userParams));
    
    if (!Item) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const uploadCount = parseInt(Item.uploadCount?.N || '0');
    const lastUploadDate = Item.lastUploadDate?.S || '';
    const today = new Date().toISOString().split('T')[0];

    // Reset count if it's a new day
    let newUploadCount = uploadCount;
    if (lastUploadDate !== today) {
      newUploadCount = 10; // Reset to max daily uploads
    }

    // Check if the user has uploads remaining
    if (newUploadCount <= 0) {
      return NextResponse.json({ 
        message: 'You have reached your maximum uploads for today. Please try again tomorrow.' 
      }, { status: 400 });
    }

    // Process the form data
    const formData = await req.formData();
    const firstPersonFullName = formData.get('firstPersonFullName') as string;
    const secondPersonFullName = formData.get('secondPersonFullName') as string;
    const file = formData.get('file') as File;

    if (!firstPersonFullName || !secondPersonFullName || !file) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
    if (!nameRegex.test(firstPersonFullName) || !nameRegex.test(secondPersonFullName)) {
      return NextResponse.json({ 
        message: "Name format is incorrect. Please use '{name} {familyname}' format." 
      }, { status: 400 });
    }

    // Check if the connection already exists before updating user quota
    const fileExtension = file.name.split('.').pop();
    const connectionExists = await checkIfFileExists(firstPersonFullName, secondPersonFullName, fileExtension!);
    
    if (connectionExists) {
      return NextResponse.json({ 
        message: 'This connection already exists in our system.' 
      }, { status: 409 });
    }

    // Use a conditional update to prevent race conditions
    const updateParams = {
      TableName: 'FL_Users',
      Key: {
        'Id': { S: userId }
      },
      UpdateExpression: 'SET uploadCount = :newCount, lastUploadDate = :date',
      ConditionExpression: '(uploadCount > :zero OR :today <> lastUploadDate)',
      ExpressionAttributeValues: {
        ':newCount': { N: (newUploadCount - 1).toString() },
        ':date': { S: today },
        ':zero': { N: '0' },
        ':today': { S: today }
      },
      ReturnValues: ReturnValue.ALL_NEW
    };

    try {
      const { Attributes } = await dynamoClient.send(new UpdateItemCommand(updateParams));
      
      // Process file upload only after successful update of user quota
      const key = `${firstPersonFullName}_${secondPersonFullName}.${fileExtension}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const s3Params = {
        Bucket: awsConfig.tempbucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      };

      await s3Client.send(new PutObjectCommand(s3Params));

      // Return success response with updated user info
      return NextResponse.json({
        message: 'File uploaded successfully!',
        user: {
          uploadCount: parseInt(Attributes?.uploadCount.N || '0'),
          lastUploadDate: Attributes?.lastUploadDate.S || today,
        }
      }, { status: 200 });
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        // Another request has already used up the user's quota
        return NextResponse.json({ 
          message: 'Upload quota has changed. Please refresh and try again.' 
        }, { status: 409 }); // 409 Conflict
      }
      throw error; // Pass other errors to the outer catch block
    }

  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json({ 
      message: 'Failed to upload file. Please try again.' 
    }, { status: 500 });
  }
}
