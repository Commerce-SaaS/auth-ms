import { forwardRef, Module } from '@nestjs/common';
import { SaaSAuthController } from './saas-auth.controller';
import { SessionModule } from 'src/session/session.module';
import { SaaSAuthService } from './saas-auth.service';
import { OauthModule } from '../oauth/oauth.module';
import { SaaSUserModule } from 'src/user/saas-user.module';

@Module({
  controllers: [SaaSAuthController],
  providers: [SaaSAuthService],
  imports: [
    forwardRef(() => SaaSUserModule),
    SessionModule,
    OauthModule
  ],
  exports: [SaaSAuthService],
})
export class SaaSAuthModule {}
