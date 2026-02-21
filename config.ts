export const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  region: process.env.AWS_REGION as string,
  bucketName: process.env.AWS_BUCKET_NAME as string,
  tempbucketName: process.env.AWS_TEMP_BUCKET_NAME as string,
};
export const key = {
  SECRET_KEY: process.env.SECRET_KEY as string,
};
export const neo4jConfig = {
  uri: "bolt+s://neo4j.findconnections.net:7687",
  user: process.env.NEO4J_USER as string,
  password: process.env.NEO4J_PASSWORD as string,
};

export const emailConfig = {
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'findconnections.net@gmail.com',
    clientId: process.env.EMAIL_AUTH_CLIENT_ID as string,
    clientSecret: process.env.EMAIL_AUTH_CLIENT_SECRET as string,
    refreshToken: process.env.EMAIL_AUTH_REFRESH_TOKEN as string,
  },
  baseUrl: 'https://findconnections.net',
};