import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { awsConfig } from '@/config';
import { validateTempImageUpload } from '@/helpers/uploadValidation';

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Comprehensive file validation (includes type, size, signature, filename pattern, and antivirus scanning)
    const validationResult = await validateTempImageUpload(file);
    
    if (!validationResult.isValid) {
      return NextResponse.json({ 
        error: validationResult.error 
      }, { status: 400 });
    }

    // Use the original filename as the key (upload to root of bucket)
    const key = file.name;

    // Convert file to buffer for S3 upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_TEMP_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));

    return NextResponse.json({ 
      message: 'File uploaded successfully!',
      filename: file.name,
      key: key
    }, { status: 200 });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Failed to upload file. Please try again.'
    }, { status: 500 });
  }
}
