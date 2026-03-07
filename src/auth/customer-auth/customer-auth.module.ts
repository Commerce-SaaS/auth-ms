import { forwardRef, Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';
import { JwtProvidersModule } from 'src/jwt-provider/jwt-provider.module';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService],
  imports: [
    forwardRef(() => CustomerModule),
    SessionModule,
    JwtProvidersModule,
  ],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
