import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaasUser } from './entities/saas-user.entity';
import { RabbitMQModule } from 'src/transports/rabbitmq.module';
import { SaaSAuthModule } from 'src/auth/saas-auth/saas-auth.module';
import { SaaSUserController } from './saas-user.controller';
import { SaaSUserService } from './saas-user.service';
import { SessionModule } from 'src/session/session.module';

@Module({
  controllers: [SaaSUserController],
  providers: [SaaSUserService],
  imports: [
    forwardRef(() => SaaSAuthModule),
    RabbitMQModule,
    TypeOrmModule.forFeature([SaasUser]),
    SessionModule,
  ],
  exports: [SaaSUserService, TypeOrmModule],
})
export class SaaSUserModule {}
