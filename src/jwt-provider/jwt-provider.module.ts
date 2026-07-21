import { JwtService } from '@nestjs/jwt';
import { Global, Module } from '@nestjs/common';
import { envs } from 'src/config';
import { JwtToken } from './enum/jwt-token.enum';

@Global()
@Module({
  providers: [
    {
      provide: JwtToken.ACCESS,
      useFactory: () =>
        new JwtService({
          secret: envs.accessTokensecret,
          signOptions: { expiresIn: '15m' },
        }),
    },
    {
      provide: JwtToken.REFRESH,
      useFactory: () =>
        new JwtService({
          secret: envs.refreshTokenSecret,
          signOptions: { expiresIn: '7d' },
        }),
    },
  ],
  exports: [JwtToken.ACCESS, JwtToken.REFRESH],
})
export class JwtProvidersModule {}
