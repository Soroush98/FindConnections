import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/services';
import { getNeo4jSession, s3Helpers } from '@/lib/db';
import { withErrorHandler, AppError } from '@/lib/errors';

async function handler(req: NextRequest): Promise<NextResponse> {
  // Verify admin authentication
  await adminService.verifySession();

  // Get node details from request
  const { fullName } = await req.json();

  if (!fullName) {
    throw AppError.missingFields(['fullName']);
  }

  // Delete node and all its relationships in Neo4j
  const session = getNeo4jSession();
  let imageUrls: string[] = [];

  try {
    // First, check if the node exists
    const nodeCheckResult = await session.run(
      `MATCH (p:Person {name: $name}) RETURN p`,
      { name: fullName }
    );

    if (nodeCheckResult.records.length === 0) {
      throw AppError.notFound(`Person with name: ${fullName}`);
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
      .map((record) => record.get('imageUrl'))
      .filter((url) => url !== null && url !== undefined);

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
      await s3Helpers.deleteObject(key);
    } catch (error) {
      console.error(`Error deleting S3 object for URL ${imageUrl}:`, error);
      // Continue with next image even if one fails
    }
  }

  return NextResponse.json(
    {
      message: 'Node and all its connections deleted successfully',
      deletedImages: imageUrls.length,
    },
    { status: 200 }
  );
}

export const POST = withErrorHandler(handler);
