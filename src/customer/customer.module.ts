import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envs } from 'src/config';
import { JwtModule } from '@nestjs/jwt';
import { RabbitMQModule } from 'src/transports/rabbitmq.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerAuthModule } from 'src/auth/customer-auth/customer-auth.module';
import { Customer } from './entities/customer.entity';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService],
  imports: [
    forwardRef(() => CustomerAuthModule),
    RabbitMQModule,
    TypeOrmModule.forFeature([Customer]),
    JwtModule.register({
      global: true,
      secret: envs.accessTokensecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  exports: [CustomerService, TypeOrmModule],
})
export class CustomerModule {}
