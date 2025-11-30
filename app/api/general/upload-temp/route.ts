import { NextRequest, NextResponse } from 'next/server';
import { s3Client, PutObjectCommand } from '@/lib/db';
import { dynamoDb } from '@/lib/db';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '@/lib/env';
import { validateTempImageUpload } from '@/helpers/uploadValidation';
import { withErrorHandler, AppError } from '@/lib/errors';

// Helper function to get client IP
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const real = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (real) {
    return real;
  }

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
}

// Helper function to get today's date string
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Helper function to check and update upload count
async function checkAndUpdateUploadCount(ip: string): Promise<{ allowed: boolean; currentCount: number }> {
  const today = getTodayDateString();
  const key = `${ip}#${today}`;

  try {
    // Get current count
    const getResponse = await dynamoDb.send(
      new GetCommand({
        TableName: 'FL_UploadCount',
        Key: { IP: key },
      })
    );

    const currentCount = getResponse.Item?.Count || 0;

    // Check if limit exceeded
    if (currentCount >= 10) {
      return { allowed: false, currentCount };
    }

    // Update count
    await dynamoDb.send(
      new PutCommand({
        TableName: 'FL_UploadCount',
        Item: {
          IP: key,
          Count: currentCount + 1,
          LastUpdated: new Date().toISOString(),
          Date: today,
        },
      })
    );

    return { allowed: true, currentCount: currentCount + 1 };
  } catch (error) {
    console.error('Error checking upload count:', error);
    // If DynamoDB fails, allow upload but log the error
    return { allowed: true, currentCount: 0 };
  }
}

async function handler(req: NextRequest): Promise<NextResponse> {
  // Get client IP
  const clientIP = getClientIP(req);

  // Check upload limit for this IP
  const { allowed, currentCount } = await checkAndUpdateUploadCount(clientIP);

  if (!allowed) {
    throw AppError.rateLimited(
      'Daily upload limit exceeded. You can upload up to 10 images per day. Please try again tomorrow.'
    );
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    throw AppError.missingFields(['file']);
  }

  // Comprehensive file validation (includes type, size, signature, filename pattern, and antivirus scanning)
  const validationResult = await validateTempImageUpload(file);

  if (!validationResult.isValid) {
    throw AppError.validation(validationResult.error || 'File validation failed');
  }

  // Use the original filename as the key (upload to root of bucket)
  const key = file.name;

  // Convert file to buffer for S3 upload
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: awsConfig.tempBucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  return NextResponse.json(
    {
      message: 'File uploaded successfully!',
      filename: file.name,
      key: key,
      uploadsToday: currentCount,
      remainingUploads: 10 - currentCount,
    },
    { status: 200 }
  );
}

export const POST = withErrorHandler(handler);
