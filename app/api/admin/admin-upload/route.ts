import { NextRequest, NextResponse } from 'next/server';
import { adminService, suggestionService } from '@/lib/services';
import { s3Helpers, ListObjectsV2Command, s3Client } from '@/lib/db';
import { connectionRepository } from '@/lib/repositories';
import { awsConfig } from '@/lib/env';
import { withErrorHandler, AppError } from '@/lib/errors';

// Check if file already exists with either name combination
async function checkIfFileExists(firstPerson: string, secondPerson: string, fileExtension: string) {
  const key1 = `${firstPerson}_${secondPerson}.${fileExtension}`;
  const key2 = `${secondPerson}_${firstPerson}.${fileExtension}`;

  const params = {
    Bucket: awsConfig.bucketName,
    Prefix: '',
  };

  const response = await s3Client.send(new ListObjectsV2Command(params));

  if (response.Contents) {
    for (const object of response.Contents) {
      if (object.Key === key1 || object.Key === key2) {
        return true;
      }
    }
  }

  return false;
}

async function handler(req: NextRequest): Promise<NextResponse> {
  // Verify admin authentication
  await adminService.verifySession();

  // Process the form data
  const formData = await req.formData();
  const firstPersonFullName = formData.get('firstPersonFullName') as string;
  const secondPersonFullName = formData.get('secondPersonFullName') as string;
  const file = formData.get('file') as File;

  if (!firstPersonFullName || !secondPersonFullName || !file) {
    throw AppError.missingFields(['firstPersonFullName', 'secondPersonFullName', 'file']);
  }

  // Name validation
  const nameRegex = /^[a-zA-Z]+\s[a-zA-Z]+$/;
  if (!nameRegex.test(firstPersonFullName) || !nameRegex.test(secondPersonFullName)) {
    throw AppError.validation("Name format is incorrect. Please use '{name} {familyname}' format.");
  }

  // Check if this connection already exists
  const fileExtension = file.name.split('.').pop();
  const connectionExists = await checkIfFileExists(firstPersonFullName, secondPersonFullName, fileExtension!);

  if (connectionExists) {
    throw AppError.alreadyExists('Connection');
  }

  // Upload file to S3
  const fileName = `${firstPersonFullName}_${secondPersonFullName}.${fileExtension}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await s3Helpers.putObject(fileName, buffer, file.type);

  // Create connection in Neo4j
  const imageUrl = `https://${awsConfig.bucketName}.s3.${awsConfig.region}.amazonaws.com/${fileName}`;
  await connectionRepository.createConnection(firstPersonFullName, secondPersonFullName, imageUrl);

  // Invalidate suggestion cache since new names might have been added
  suggestionService.invalidateCache();

  return NextResponse.json(
    {
      message: 'Connection uploaded successfully',
      imageUrl: imageUrl,
    },
    { status: 200 }
  );
}

export const POST = withErrorHandler(handler);
