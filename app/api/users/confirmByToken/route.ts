"use server";
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { awsConfig } from "@/config";

const client = new DynamoDBClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  const params = {
    TableName: "FL_Users",
    FilterExpression: "confirmationToken = :token",
    ExpressionAttributeValues: {
      ":token": { S: token },
    },
  };
  const result = await client.send(new ScanCommand(params));
  const user = result.Items?.[0];
  if (!user || !user.tokenExpiration?.N || parseInt(user.tokenExpiration.N) < Date.now()) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 400 });
  }
  // confirm the user
  await client.send(new UpdateItemCommand({
    TableName: "FL_Users",
    Key: { Id: { S: user.Id.S! } } as Record<string, import("@aws-sdk/client-dynamodb").AttributeValue>,
    UpdateExpression: "set isConfirmed = :confirmed, confirmationToken = :null, tokenExpiration = :null",
    ExpressionAttributeValues: {
      ":confirmed": { BOOL: true },
      ":null": { NULL: true },
    },
  }));
  return NextResponse.json({ success: true });
}