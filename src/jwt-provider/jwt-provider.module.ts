import { JwtService } from "@nestjs/jwt";
import { Module } from '@nestjs/common';
import { envs } from "src/config";

@Module({
  providers: [
    {
      provide: 'JWT_ACCESS',
      useFactory: () =>
        new JwtService({
          secret: envs.accessTokensecret,
          signOptions: { expiresIn: '15m' },
        }),
    },
    {
      provide: 'JWT_REFRESH',
      useFactory: () =>
        new JwtService({
          secret: envs.refreshTokenSecret,
          signOptions: { expiresIn: '7d' },
        }),
    },
  ],
  exports: ['JWT_ACCESS', 'JWT_REFRESH'],
})
export class JwtProvidersModule {}
