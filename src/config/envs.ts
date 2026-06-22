import { z } from 'zod';
import 'dotenv/config';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    JWT_SECRET_ACCESS: z.string(),
    JWT_SECRET_REFRESH: z.string(),
    JWT_SECRET_VERIFY_EMAIL: z.string(),
    JWT_SECRET_RESET: z.string(),
    PORT: z.coerce.number().default(3000),
    DB_PORT: z.coerce.number().default(5432),
    DB_HOST: z.string(),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string(),
    RABBITMQ_URL: z.string().refine((val) => /^amqps?:\/\//.test(val), {
      message: 'RABBITMQ_URL must start with amqp:// or amqps://',
    }),
    RABBITMQ_QUEUE: z.string().min(1, 'RABBITMQ_QUEUE cannot be empty'),
    RMQ_EVENTS_QUEUE_NOTIFICATIONS: z
      .string()
      .min(1, 'RMQ_EVENTS_QUEUE cannot be empty'),
    RMQ_EVENTS_QUEUE_AUTHZ: z
      .string()
      .min(1, 'RMQ_EVENTS_QUEUE_AUTHZ cannot be empty'),
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASS: z.string(),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID cannot be empty'),
    VERIFY_EMAIL_URL: z.string().url(),
    RESET_PASSWORD_URL: z.string().url(),
  })
  .required();

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error('Invalid environment variables');
}

export const envs = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  dbPort: parsedEnv.data.DB_PORT,
  dbHost: parsedEnv.data.DB_HOST,
  postgresUser: parsedEnv.data.POSTGRES_USER,
  postgresPassword: parsedEnv.data.POSTGRES_PASSWORD,
  postgresDb: parsedEnv.data.POSTGRES_DB,
  rabbitmqUrl: parsedEnv.data.RABBITMQ_URL,
  rabbitmqQueue: parsedEnv.data.RABBITMQ_QUEUE,
  rabbitmqEventsQueue: parsedEnv.data.RMQ_EVENTS_QUEUE_NOTIFICATIONS,
  rabbitmqAuthzEventQueue: parsedEnv.data.RMQ_EVENTS_QUEUE_AUTHZ,
  accessTokensecret: parsedEnv.data.JWT_SECRET_ACCESS,
  refreshTokenSecret: parsedEnv.data.JWT_SECRET_REFRESH,
  verifyEmailTokenSecret: parsedEnv.data.JWT_SECRET_VERIFY_EMAIL,
  resetTokenSecret: parsedEnv.data.JWT_SECRET_RESET,
  redisHost: parsedEnv.data.REDIS_HOST,
  redisPort: parsedEnv.data.REDIS_PORT,
  googleClientId: parsedEnv.data.GOOGLE_CLIENT_ID,
  resetPasswordUrl: parsedEnv.data.RESET_PASSWORD_URL,
  verifyEmailUrl: parsedEnv.data.VERIFY_EMAIL_URL,
  redisPass: parsedEnv.data.REDIS_PASS
};
