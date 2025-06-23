import { NextRequest, NextResponse } from "next/server";
import { neo4jConfig, awsConfig } from "@/config";
import neo4j from "neo4j-driver";
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const driver = neo4j.driver(
    neo4jConfig.uri,
    neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password)
);
  

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name1 = searchParams.get('name1');
  const name2 = searchParams.get('name2');
  if (name1 && name2) {
    const data = await findConnections(name1, name2);
    return NextResponse.json(data);
  } else {
    return NextResponse.json({ error: "Both name1 and name2 must be provided" }, { status: 400 });
  }
}


async function findConnections(name1: string, name2: string) {
    
    const session = driver.session();
    try {
      const result = await session.run(
        `
        MATCH path = shortestPath((u1:Person {name: $name1})-[*]-(u2:Person {name: $name2}))
        RETURN path
        `,
        { name1, name2 }
      );
      const connections = await Promise.all(
        result.records.map(async (record) => {
          const path = record.get("path");
          const segments = path.segments.map((segment: { start: { properties: { name: string } }, relationship: { type: string, properties: { imageUrl: string } }, end: { properties: { name: string } } }) => ({
            start: segment.start.properties.name,
            relationship: segment.relationship.type,
            end: segment.end.properties.name,
            imageUrl: segment.relationship.properties.imageUrl,
          }));
  
          const imageUrls = await Promise.all(
            segments.map(async (segment: { start: string, relationship: string, end: string, imageUrl: string | null }) => {
              if (segment.imageUrl) {
                const fileName = segment.imageUrl.split("/").pop();
                const presignedUrl = fileName ? await getPresignedUrl(fileName) : null;
                
                return presignedUrl;
              }
              return null;
            })
          );
  
          return { segments, imageUrls };
        })
      );
  
      return connections;
    } finally {
      await session.close();
    }
  }  
  async function getPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: key,
    });
  
    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    return url;
  }