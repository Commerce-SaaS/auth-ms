import { forwardRef, Module } from '@nestjs/common';
import { SaaSUserService } from './saas-user.service';
import { SaaSUserController } from './saas-user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaasUser } from './entities/saas-user.entity';
import { envs } from 'src/config';
import { JwtModule } from '@nestjs/jwt';
import { RabbitMQModule } from 'src/transports/rabbitmq.module';
import { SaaSAuthModule } from 'src/auth/saas-auth/saas-auth.module';

@Module({
  controllers: [SaaSUserController],
  providers: [SaaSUserService],
  imports: [
    forwardRef(() => SaaSAuthModule),
    RabbitMQModule,
    TypeOrmModule.forFeature([SaasUser]),
    JwtModule.register({
      global: true,
      secret: envs.accessTokensecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  exports: [SaaSUserService, TypeOrmModule],
})
export class SaaSUserModule {}
