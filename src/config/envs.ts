import { z } from 'zod';
import 'dotenv/config';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    JWT_SECRET_ACCESS: z.string(),
    JWT_SECRET_REFRESH: z.string(),
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
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number().default(6379),
    SMTP_HOST: z.string().min(1, 'SMTP_HOST cannot be empty'),
    SMTP_PORT: z.coerce.number().default(465),
    SMTP_USER: z.string().min(1, 'SMTP_USER cannot be empty'),
    SMTP_PASS: z.string().min(1, 'SMTP_PASS cannot be empty'),
    SMTP_FROM: z.string().min(1, 'SMTP_FROM cannot be empty'),
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
  accessTokensecret: parsedEnv.data.JWT_SECRET_ACCESS,
  refreshTokenSecret: parsedEnv.data.JWT_SECRET_REFRESH,
  redisHost: parsedEnv.data.REDIS_HOST,
  redisPort: parsedEnv.data.REDIS_PORT,
  smtpHost: parsedEnv.data.SMTP_HOST,
  smtpPort: parsedEnv.data.SMTP_PORT,
  smtpUser: parsedEnv.data.SMTP_USER,
  smtpPass: parsedEnv.data.SMTP_PASS,
  smtpFrom: parsedEnv.data.SMTP_FROM,
  resetPasswordUrl: parsedEnv.data.RESET_PASSWORD_URL,
};
