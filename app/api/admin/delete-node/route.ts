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

    // Get node details from request
    const { fullName } = await req.json();

    if (!fullName) {
      return NextResponse.json({ message: 'Person name is required' }, { status: 400 });
    }    // Delete node and all its relationships in Neo4j
    const session = driver.session();
    let imageUrls: string[] = [];

    try {
      // First, check if the node exists
      const nodeCheckResult = await session.run(
        `MATCH (p:Person {name: $name}) RETURN p`,
        { name: fullName }
      );

      if (nodeCheckResult.records.length === 0) {
        return NextResponse.json({ 
          message: `No node with such name found: ${fullName}` 
        }, { status: 404 });
      }

      // Get all image URLs associated with this person's relationships
      const result = await session.run(
        `
        MATCH (p:Person {name: $name})-[r:PHOTOGRAPHED_WITH]-()
        RETURN r.imageUrl as imageUrl
        UNION
        MATCH ()-[r:PHOTOGRAPHED_WITH]->(p:Person {name: $name})
        RETURN r.imageUrl as imageUrl
        `,
        { name: fullName }
      );

      imageUrls = result.records
        .map(record => record.get('imageUrl'))
        .filter(url => url !== null && url !== undefined);

      // Then delete the node and all its relationships
      await session.run(
        `
        MATCH (p:Person {name: $name})
        DETACH DELETE p
        `,
        { name: fullName }
      );
    } finally {
      await session.close();
    }

    // Delete all associated images from S3
    for (const imageUrl of imageUrls) {
      try {
        const urlParts = new URL(imageUrl);
        const key = urlParts.pathname.substring(1); // Remove leading slash

        await s3Client.send(new DeleteObjectCommand({
          Bucket: awsConfig.bucketName,
          Key: key
        }));
      } catch (error) {
        console.error(`Error deleting S3 object for URL ${imageUrl}:`, error);
        // Continue with next image even if one fails
      }
    }

    return NextResponse.json({ 
      message: 'Node and all its connections deleted successfully',
      deletedImages: imageUrls.length
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting node:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
