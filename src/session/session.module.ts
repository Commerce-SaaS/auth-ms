import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { JwtProvidersModule } from 'src/jwt-provider/jwt-provider.module';

@Module({
  controllers: [SessionController],
  providers: [SessionService],
  imports: [JwtProvidersModule],
  exports: [SessionService],
})
export class SessionModule {}
