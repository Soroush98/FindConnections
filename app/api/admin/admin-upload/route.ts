import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { awsConfig, neo4jConfig, key } from '@/config';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import neo4j from 'neo4j-driver';

const SECRET_KEY = key.SECRET_KEY;

// Initialize S3 client
const s3Client = new S3Client({
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
    Bucket: awsConfig.bucketName,
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

// Initialize Neo4j driver
const driver = neo4j.driver(
  neo4jConfig.uri,
  neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password)
);

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY) as { email: string, role: string };
      if (decoded.role !== 'admin') {
        return NextResponse.json({ message: 'Not authorized' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Process the form data
    const formData = await req.formData();
    const firstPersonFullName = formData.get('firstPersonFullName') as string;
    const secondPersonFullName = formData.get('secondPersonFullName') as string;
    const file = formData.get('file') as File;

    if (!firstPersonFullName || !secondPersonFullName || !file) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    // Name validation
    const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
    if (!nameRegex.test(firstPersonFullName) || !nameRegex.test(secondPersonFullName)) {
      return NextResponse.json({ 
        message: "Name format is incorrect. Please use '{name} {familyname}' format."
      }, { status: 400 });
    }

    // Check if this connection already exists
    const fileExtension = file.name.split('.').pop();
    const connectionExists = await checkIfFileExists(firstPersonFullName, secondPersonFullName, fileExtension!);
    
    if (connectionExists) {
      return NextResponse.json({ 
        message: 'This connection already exists in the system.'
      }, { status: 409 });
    }

    // Upload file to S3
    const fileName = `${firstPersonFullName}_${secondPersonFullName}.${fileExtension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const s3Params = {
      Bucket: awsConfig.bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    };

    await s3Client.send(new PutObjectCommand(s3Params));

    // Create connection in Neo4j
    const imageUrl = `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${fileName}`;
    const session = driver.session();

    try {
      await session.run(
        `
        MERGE (p1:Person {name: $firstPersonName})
        MERGE (p2:Person {name: $secondPersonName})
        MERGE (p1)-[r:PHOTOGRAPHED_WITH {imageUrl: $imageUrl}]->(p2)
        RETURN p1, r, p2
        `,
        {
          firstPersonName: firstPersonFullName,
          secondPersonName: secondPersonFullName,
          imageUrl: imageUrl
        }
      );
    } finally {
      await session.close();
    }

    return NextResponse.json({ 
      message: 'Connection uploaded successfully',
      imageUrl: imageUrl
    }, { status: 200 });
  } catch (error) {
    console.error('Error in admin upload:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
