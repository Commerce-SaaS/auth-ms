import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { envs } from './config';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { JwtProvidersModule } from './jwt-provider/jwt-provider.module';
import { CustomMailerModule } from './custom-mailer/custom-mailer.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: envs.dbHost,
      port: envs.dbPort ?? 5432,
      username: envs.postgresUser,
      password: envs.postgresPassword,
      database: envs.postgresDb,
      autoLoadEntities: true,
      synchronize: envs.nodeEnv === 'development',
    }),
    UserModule,
    RedisModule,
    AuthModule,
    SessionModule,
    JwtProvidersModule,
    CustomMailerModule,
    OrganizationModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
