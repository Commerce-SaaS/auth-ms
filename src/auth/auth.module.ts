import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { SessionModule } from 'src/session/session.module';
import { JwtProvidersModule } from 'src/jwt-provider/jwt-provider.module';
import { CustomMailerModule } from 'src/custom-mailer/custom-mailer.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [forwardRef(() => UserModule), SessionModule, JwtProvidersModule, CustomMailerModule],
  exports: [AuthService],
})
export class AuthModule {}
