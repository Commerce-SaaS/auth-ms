import { forwardRef, Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerModule } from 'src/customer/customer.module';
import { OauthModule } from '../oauth/oauth.module';

@Module({
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService],
  imports: [
    forwardRef(() => CustomerModule),
    SessionModule,
    OauthModule
  ],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
