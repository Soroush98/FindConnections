import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { key, awsConfig, neo4jConfig } from '@/config';
import neo4j from 'neo4j-driver';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

const SECRET_KEY = key.SECRET_KEY;

// Initialize Neo4j driver
const driver = neo4j.driver(
  neo4jConfig.uri,
  neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password)
);

// Initialize S3 client
const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

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

    // Get connection details from request
    const { firstPersonFullName, secondPersonFullName } = await req.json();

    if (!firstPersonFullName || !secondPersonFullName) {
      return NextResponse.json({ message: 'Both names are required' }, { status: 400 });
    }

    // Delete connection in Neo4j and get image URL for S3 deletion
    const session = driver.session();
    let imageUrl: string | null = null;

    try {
      // First, get the image URL
      const result = await session.run(
        `
        MATCH (p1:Person {name: $firstPersonName})-[r:PHOTOGRAPHED_WITH]->(p2:Person {name: $secondPersonName})
        RETURN r.imageUrl as imageUrl
        `,
        {
          firstPersonName: firstPersonFullName,
          secondPersonName: secondPersonFullName
        }
      );

      if (result.records.length === 0) {
        return NextResponse.json({ message: 'Connection not found' }, { status: 404 });
      }

      imageUrl = result.records[0].get('imageUrl');

      // Then delete the relationship
      await session.run(
        `
        MATCH (p1:Person {name: $firstPersonName})-[r:PHOTOGRAPHED_WITH]->(p2:Person {name: $secondPersonName})
        DELETE r
        `,
        {
          firstPersonName: firstPersonFullName,
          secondPersonName: secondPersonFullName
        }
      );
    } finally {
      await session.close();
    }

    // Delete image from S3 if we have a URL
    if (imageUrl) {
      try {
        const urlParts = new URL(imageUrl);
        const key = urlParts.pathname.substring(1); // Remove leading slash

        await s3Client.send(new DeleteObjectCommand({
          Bucket: awsConfig.bucketName,
          Key: key
        }));
      } catch (error) {
        console.error('Error deleting S3 object:', error);
        // Continue even if S3 deletion fails
      }
    }

    return NextResponse.json({ message: 'Connection deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
