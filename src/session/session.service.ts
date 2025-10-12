import { Inject, Injectable } from '@nestjs/common';
import { SessionData } from './interfaces/session-data.interface';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import Redis from 'ioredis';
import { JwtData } from 'src/common/interfaces/jwt-data.interface';
import { JwtService } from '@nestjs/jwt';
import { envs } from 'src/config';

@Injectable()
export class SessionService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly jwtService: JwtService,
  ) {}

  async verifyToken(token: string) {
    try {
      const user: JwtData = this.jwtService.verify(token, {
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
      console.error('Error saving session in Redis:', error);
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
      console.error('Error logging out session:', error);
      // Puedes lanzar una excepción controlada
      RpcExceptionHelper.internalServerError('Could not logout session');
    }
  }

  async logoutAllSessions(userId: string) {
    if (!userId) {
      RpcExceptionHelper.badRequestExcetion('Invalid userId');
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
      console.error('Error logging out all sessions:', error);
      RpcExceptionHelper.internalServerError('Could not logout all sessions');
    }
  }
}
