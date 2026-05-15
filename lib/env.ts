import { z } from 'zod';

/**
 * Environment variable schema validation using Zod
 * This ensures all required environment variables are present and correctly typed
 */
const envSchema = z.object({
  // AWS Configuration — only Rekognition uses AWS now (celebrity recognition in the
  // Serper ingestion pipeline). DynamoDB and S3 have both been replaced by Supabase.
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),

  // JWT Secret (used for admin + user session cookies)
  SECRET_KEY: z.string().min(32, 'SECRET_KEY must be at least 32 characters'),

  // Neo4j Configuration
  NEO4J_URI: z.string().url('NEO4J_URI must be a valid URI').optional(),
  NEO4J_USER: z.string().min(1, 'NEO4J_USER is required'),
  NEO4J_PASSWORD: z.string().min(1, 'NEO4J_PASSWORD is required'),

  // Supabase — backs admin auth (admins table) and Storage (connection-images)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Serper (Google-results-as-JSON, pair-photo ingestion source)
  SERPER_API_KEY: z.string().min(1).optional(),
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
} as const;

export const jwtConfig = {
  secretKey: env.SECRET_KEY,
} as const;

export const neo4jConfig = {
  uri: env.NEO4J_URI || 'neo4j+ssc://neo4j.findconnections.net:7687',
  user: env.NEO4J_USER,
  password: env.NEO4J_PASSWORD,
} as const;

export const supabaseConfig = {
  url:            env.SUPABASE_URL,
  anonKey:        env.SUPABASE_ANON_KEY,
  serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

export const serperConfig = {
  apiKey: env.SERPER_API_KEY,
} as const;
