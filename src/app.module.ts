import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from './config';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';

import { SessionModule } from './session/session.module';
import { RabbitMQModule } from './transports/rabbitmq.module';
import {
  AUTHZ_EVENTS_CLIENT,
  NOTIFICATIONS_EVENTS_CLIENT,
  ORDERS_EVENTS_CLIENT,
  ORGANIZATION_EVENTS_CLIENT,
  PAYMENTS_EVENTS_CLIENT,
} from './config/services';
import { SaaSAuthModule } from './auth/saas-auth/saas-auth.module';
import { OauthModule } from './auth/oauth/oauth.module';
import { SaaSUserModule } from './user/saas-user.module';
import { CustomerAuthModule } from './auth/customer-auth/customer-auth.module';
import { CustomerModule } from './customer/customer.module';

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
    SaaSUserModule,
    SaaSAuthModule,
    CustomerAuthModule,
    CustomerModule,
    RedisModule,
    SessionModule,
    RabbitMQModule.register({
      name: NOTIFICATIONS_EVENTS_CLIENT,
      queue: envs.rabbitmqEventsQueue,
      url: envs.rabbitmqUrl,
    }),
    RabbitMQModule.register({
      name: AUTHZ_EVENTS_CLIENT,
      queue: envs.rabbitmqAuthzEventQueue,
      url: envs.rabbitmqUrl,
    }),
    // Outbound clients for the customer.anonymized event fan-out
    RabbitMQModule.register({
      name: ORDERS_EVENTS_CLIENT,
      queue: envs.rabbitmqOrdersEventsQueue,
      url: envs.rabbitmqUrl,
    }),
    RabbitMQModule.register({
      name: PAYMENTS_EVENTS_CLIENT,
      queue: envs.rabbitmqPaymentsEventsQueue,
      url: envs.rabbitmqUrl,
    }),
    RabbitMQModule.register({
      name: ORGANIZATION_EVENTS_CLIENT,
      queue: envs.rabbitmqOrganizationEventsQueue,
      url: envs.rabbitmqUrl,
    }),
    OauthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
