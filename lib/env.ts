import { z } from 'zod';

/**
 * Environment variable schema validation using Zod
 * This ensures all required environment variables are present and correctly typed
 */
const envSchema = z.object({
  // AWS Configuration
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_BUCKET_NAME: z.string().min(1, 'AWS_BUCKET_NAME is required'),
  AWS_TEMP_BUCKET_NAME: z.string().min(1, 'AWS_TEMP_BUCKET_NAME is required'),

  // JWT Secret
  SECRET_KEY: z.string().min(32, 'SECRET_KEY must be at least 32 characters'),

  // Neo4j Configuration
  NEO4J_USER: z.string().min(1, 'NEO4J_USER is required'),
  NEO4J_PASSWORD: z.string().min(1, 'NEO4J_PASSWORD is required'),

  // Email Configuration (OAuth2)
  EMAIL_AUTH_CLIENT_ID: z.string().min(1, 'EMAIL_AUTH_CLIENT_ID is required'),
  EMAIL_AUTH_CLIENT_SECRET: z.string().min(1, 'EMAIL_AUTH_CLIENT_SECRET is required'),
  EMAIL_AUTH_REFRESH_TOKEN: z.string().min(1, 'EMAIL_AUTH_REFRESH_TOKEN is required'),

  // Optional: VirusTotal API Key
  VIRUSTOTAL_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables
 * Throws at application startup if validation fails
 */
function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(', ')}`)
      .join('\n');

    console.error('❌ Invalid environment variables:\n' + errorMessages);
    throw new Error('Invalid environment variables. Check server logs for details.');
  }

  return parsed.data;
}

// Export validated environment variables
export const env = validateEnv();

// Export individual configurations derived from validated env
export const awsConfig = {
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
  bucketName: env.AWS_BUCKET_NAME,
  tempBucketName: env.AWS_TEMP_BUCKET_NAME,
} as const;

export const jwtConfig = {
  secretKey: env.SECRET_KEY,
} as const;

export const neo4jConfig = {
  uri: 'neo4j+ssc://neo4j.findconnections.net:7687',
  user: env.NEO4J_USER,
  password: env.NEO4J_PASSWORD,
} as const;

export const emailConfig = {
  service: 'gmail',
  auth: {
    type: 'OAuth2' as const,
    user: 'findconnections.net@gmail.com',
    clientId: env.EMAIL_AUTH_CLIENT_ID,
    clientSecret: env.EMAIL_AUTH_CLIENT_SECRET,
    refreshToken: env.EMAIL_AUTH_REFRESH_TOKEN,
  },
  baseUrl: 'https://findconnections.net',
} as const;
