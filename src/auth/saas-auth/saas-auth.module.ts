import { forwardRef, Module } from '@nestjs/common';
import { SaaSAuthController } from './saas-auth.controller';
import { SaaSUserModule } from 'src/user/saas-user.module';
import { SessionModule } from 'src/session/session.module';
import { JwtProvidersModule } from 'src/jwt-provider/jwt-provider.module';
import { SaaSAuthService } from './saas-auth.service';

@Module({
  controllers: [SaaSAuthController],
  providers: [SaaSAuthService],
  imports: [
    forwardRef(() => SaaSUserModule),
    SessionModule,
    JwtProvidersModule,
  ],
  exports: [SaaSAuthService],
})
export class SaaSAuthModule {}
