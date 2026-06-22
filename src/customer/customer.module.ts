import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from 'src/transports/rabbitmq.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CustomerAuthModule } from 'src/auth/customer-auth/customer-auth.module';
import { Customer } from './entities/customer.entity';
import { SessionModule } from 'src/session/session.module';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService],
  imports: [
    forwardRef(() => CustomerAuthModule),
    RabbitMQModule,
    TypeOrmModule.forFeature([Customer]),
    SessionModule
  ],
  exports: [CustomerService, TypeOrmModule],
})
export class CustomerModule {}
