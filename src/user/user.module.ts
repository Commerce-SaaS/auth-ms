import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { envs } from 'src/config';
import { JwtModule } from '@nestjs/jwt';
import { RabbitMQModule } from 'src/transports/rabbitmq.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    forwardRef(() => AuthModule),
    RabbitMQModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      global: true,
      secret: envs.accessTokensecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
