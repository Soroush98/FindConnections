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

  // JWT Secret
  SECRET_KEY: z.string().min(32, 'SECRET_KEY must be at least 32 characters'),

  // Neo4j Configuration
  NEO4J_URI: z.string().url('NEO4J_URI must be a valid URI').optional(),
  NEO4J_USER: z.string().min(1, 'NEO4J_USER is required'),
  NEO4J_PASSWORD: z.string().min(1, 'NEO4J_PASSWORD is required'),

  // Email Configuration (OAuth2)
  EMAIL_AUTH_CLIENT_ID: z.string().min(1, 'EMAIL_AUTH_CLIENT_ID is required'),
  EMAIL_AUTH_CLIENT_SECRET: z.string().min(1, 'EMAIL_AUTH_CLIENT_SECRET is required'),
  EMAIL_AUTH_REFRESH_TOKEN: z.string().min(1, 'EMAIL_AUTH_REFRESH_TOKEN is required'),

  // --- Supabase (Phase 1: present but not yet wired into the app) ---
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // --- Cutover feature flags ---
  // Flip these per area as phases land. Defaults keep the existing AWS stack.
  DB_PROVIDER:      z.enum(['dynamo', 'supabase']).default('dynamo'),
  STORAGE_PROVIDER: z.enum(['s3', 'supabase']).default('s3'),
  AUTH_PROVIDER:    z.enum(['custom-jwt', 'supabase']).default('custom-jwt'),

  // --- Phase 6: Google Custom Search (pair-photo ingestion) ---
  GOOGLE_CSE_API_KEY:   z.string().min(1).optional(),
  GOOGLE_CSE_ENGINE_ID: z.string().min(1).optional(),
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
  url:             env.SUPABASE_URL,
  anonKey:         env.SUPABASE_ANON_KEY,
  serviceRoleKey:  env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

export const providers = {
  db:      env.DB_PROVIDER,
  storage: env.STORAGE_PROVIDER,
  auth:    env.AUTH_PROVIDER,
} as const;

export const googleCseConfig = {
  apiKey:   env.GOOGLE_CSE_API_KEY,
  engineId: env.GOOGLE_CSE_ENGINE_ID,
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
