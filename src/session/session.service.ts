import { Inject, Injectable } from '@nestjs/common';
import { SessionData } from './interfaces/session-data.interface';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import Redis from 'ioredis';
import { JwtData } from 'src/common/interfaces/jwt-data.interface';
import { JwtService } from '@nestjs/jwt';
import { envs } from 'src/config';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Injectable()
export class SessionService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly jwtService: JwtService,
    @Inject('JWT_REFRESH') private readonly jwtRefreshService: JwtService,
  ) {}

  async signResetToken(payload: JwtPayload & { type: 'reset' }) {
    if (!payload.jti || !payload.sub) {
      RpcExceptionHelper.internalServerError('Invalid reset token payload');
    }

    const resetToken = await this.jwtService.signAsync(payload, {
      secret: envs.resetTokenSecret,
      expiresIn: '15m',
    });

    await this.saveResetToken(payload.jti, payload.sub, 15 * 60);

    return { resetToken };
  }

  async signAuthTokens(payload: JwtPayload) {
    const { jti, sub, platformRole } = payload;

    const accessToken = await this.jwtService.signAsync(
      { jti, sub, type: 'access', platformRole },
      {
        secret: envs.accessTokensecret,
        expiresIn: '30m',
      },
    );

    const refreshToken = await this.jwtRefreshService.signAsync(
      { jti, sub, type: 'refresh', platformRole },
      {
        secret: envs.refreshTokenSecret,
        expiresIn: '7d',
      },
    );

    return { accessToken, refreshToken };
  }
  async verifyToken(token: string) {
    try {
      const user = this.jwtService.verify<JwtData>(token, {
        secret: envs.accessTokensecret,
      });
      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        RpcExceptionHelper.unauthorized('Token expired');
      }
      RpcExceptionHelper.unauthorized('Invalid token');
    }
  }

  async saveSession(sessionData: SessionData) {
    const { data, jti, ttl } = sessionData;

    try {
      await this.redis
        .multi()
        .set(`session:${jti}`, JSON.stringify(data), 'EX', ttl)
        .sadd(`user-sessions:${data.userId}`, jti)
        .expire(`user-sessions:${data.userId}`, ttl)
        .exec();
    } catch (error) {
      RpcExceptionHelper.internalServerError('Could not save session');
    }
  }

  async logoutSession(token: string) {
    try {
      const user = await this.verifyToken(token);

      if (!user?.jti || !user?.sub) {
        RpcExceptionHelper.unauthorized('Invalid token payload');
      }

      await this.redis
        .multi()
        .del(`session:${user.jti}`)
        .srem(`user-sessions:${user.sub}`, user.jti)
        .exec();

      return { message: 'Session logged out successfully' };
    } catch (error) {
      RpcExceptionHelper.internalServerError('Could not logout session');
    }
  }

  async logoutAllSessions(userId: string) {
    if (!userId) {
      RpcExceptionHelper.badRequestException('Invalid userId');
    }

    try {
      const jtis = await this.redis.smembers(`user-sessions:${userId}`);

      if (jtis.length) {
        const multi = this.redis.multi();

        jtis.forEach((jti) => multi.del(`session:${jti}`));
        multi.del(`user-sessions:${userId}`);

        await multi.exec();
      }

      return { message: 'All sessions logged out successfully' };
    } catch (error) {
      RpcExceptionHelper.internalServerError('Could not logout all sessions');
    }
  }

  async saveResetToken(jti: string, userId: string, ttl = 15 * 60) {
    try {
      await this.redis
        .multi()
        .set(`reset-token:${jti}`, userId, 'EX', ttl)
        .sadd(`user-reset-tokens:${userId}`, jti)
        .expire(`user-reset-tokens:${userId}`, ttl)
        .exec();
    } catch {
      RpcExceptionHelper.internalServerError('Could not save reset token');
    }
  }

  async consumeResetToken(jti: string): Promise<string | null> {
    try {
      const key = `reset-token:${jti}`;
      const userId = await this.redis.get(key);

      if (!userId) return null;

      await this.redis.del(key);
      return userId;
    } catch {
      return null;
    }
  }

  async invalidateAllUserResetTokens(userId: string) {
    if (!userId) return;

    try {
      const key = `user-reset-tokens:${userId}`;
      const jtis = await this.redis.smembers(key);

      if (!jtis.length) return;

      const pipeline = this.redis.multi();

      for (const jti of jtis) {
        pipeline.del(`reset-token:${jti}`);
      }

      pipeline.del(key);

      await pipeline.exec();
    } catch (error) {
      console.error('Error invalidating all user reset tokens:', error);
      RpcExceptionHelper.internalServerError(
        'Could not invalidate user reset tokens',
      );
    }
  }
}
