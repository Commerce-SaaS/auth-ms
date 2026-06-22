import { Inject, Injectable } from '@nestjs/common';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { JwtToken } from 'src/jwt-provider/enum/jwt-token.enum';
import {
  JwtPayload,
  TokenTypeEnum,
} from 'src/common/interfaces/jwt-payload.interface';
import { SessionData } from './interfaces/session-data.interface';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class SessionService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(JwtToken.ACCESS) private readonly jwtAccess: JwtService,
    @Inject(JwtToken.REFRESH) private readonly jwtRefresh: JwtService,
    @Inject(JwtToken.RESET) private readonly jwtReset: JwtService,
  ) {}

  async saveVerifyEmailCode(userId: string, code: string, ttl = 60 * 15) {
    try {
      await this.redis.set(`verify-email-code:${userId}`, code, 'EX', ttl);
    } catch {
      RpcExceptionHelper.internalServerError(
        'Could not save verify-email code',
      );
    }
  }

  async getVerifyEmailCode(userId: string): Promise<string | null> {
    return this.redis.get(`verify-email-code:${userId}`);
  }

  async incrementVerifyAttempts(
    userId: string,
    ttl = 60 * 15,
  ): Promise<number> {
    const key = `verify-email-attempts:${userId}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) await this.redis.expire(key, ttl); // TTL al primer fallo
    return attempts;
  }

  async clearVerifyEmailCode(userId: string) {
    await this.redis.del(
      `verify-email-code:${userId}`,
      `verify-email-attempts:${userId}`,
    );
  }

  async saveResetCode(userId: string, code: string, ttl = 60 * 15) {
    await this.redis.set(`reset-code:${userId}`, code, 'EX', ttl);
  }

  async getResetCode(userId: string): Promise<string | null> {
    return this.redis.get(`reset-code:${userId}`);
  }

  async incrementResetAttempts(userId: string, ttl = 60 * 15): Promise<number> {
    const key = `reset-attempts:${userId}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) await this.redis.expire(key, ttl);
    return attempts;
  }

  async clearResetCode(userId: string) {
    await this.redis.del(`reset-code:${userId}`, `reset-attempts:${userId}`);
  }
  async tryStartResendCooldown(userId: string, ttl = 60): Promise<boolean> {
    const key = `verify-email-resend-cooldown:${userId}`;
    const result = await this.redis.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK'; // true: arrancó (permitido) · null: ya estaba en cooldown
  }

  async signAccessToken(payload: JwtPayload) {
    const { jti, sub, platformRole, aud } = payload;

    const accessToken = await this.jwtAccess.signAsync({
      jti,
      sub,
      aud,
      type: TokenTypeEnum.ACCESS,
      platformRole,
    });

    return accessToken;
  }

  async signRefreshToken(payload: JwtPayload) {
    const { jti, sub, platformRole, aud } = payload;

    const refreshToken = await this.jwtRefresh.signAsync({
      jti,
      sub,
      aud,
      type: TokenTypeEnum.REFRESH,
      platformRole,
    });

    return refreshToken;
  }

  async signResetToken(payload: JwtPayload) {
    const { jti, sub, platformRole, aud } = payload;

    const refreshToken = await this.jwtReset.signAsync({
      jti,
      sub,
      aud,
      type: TokenTypeEnum.REFRESH,
      platformRole,
    });

    return refreshToken;
  }

  async verifyResetToken(token: string): Promise<JwtPayload> {
    return this.jwtReset.verifyAsync<JwtPayload>(token);
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtRefresh.verifyAsync<JwtPayload>(token);
  }

  private clamp(v?: string, max = 256) {
    return v ? v.slice(0, max) : null;
  }

  async saveSession(sessionData: SessionData) {
    const { data, jti, ttl, clientInfo, createdAt } = sessionData;
    const now = new Date().toISOString();

    const record = {
      userId: data.userId,
      createdAt: createdAt ?? now,
      userAgent: this.clamp(clientInfo?.userAgent),
      ip: clientInfo?.ip ?? null,
      deviceName: this.clamp(clientInfo?.deviceName, 64),
    };

    try {
      await this.redis
        .multi()
        .set(`session:${jti}`, JSON.stringify(record), 'EX', ttl)
        .sadd(`user-sessions:${data.userId}`, jti)
        .expire(`user-sessions:${data.userId}`, ttl)
        .exec();
    } catch (error) {
      RpcExceptionHelper.internalServerError('Could not save session');
    }
  }

  async getSession(
    jti: string,
  ): Promise<{ userId: string; createdAt?: string } | null> {
    const raw = await this.redis.get(`session:${jti}`);
    return raw ? JSON.parse(raw) : null;
  }

  async listSessions(userId: string, currentJti?: string) {
    const jtis = await this.redis.smembers(`user-sessions:${userId}`);
    if (!jtis.length) return [];

    const pipeline = this.redis.pipeline();
    jtis.forEach((jti) => pipeline.get(`session:${jti}`));
    const results = await pipeline.exec();

    const sessions: any[] = [];
    const stale: string[] = [];

    jtis.forEach((jti, i) => {
      const raw = results?.[i]?.[1] as string | null;
      if (!raw) {
        stale.push(jti);
        return;
      }
      const s = JSON.parse(raw);

      const ua = new UAParser(s.userAgent ?? '').getResult();
      const parsed = [ua.browser.name, ua.os.name].filter(Boolean).join(' · ');
      const device = s.deviceName || parsed || 'Unknown device';

      sessions.push({
        jti,
        device,
        ip: s.ip ?? null,
        createdAt: s.createdAt ?? null,
        current: jti === currentJti,
      });
    });

    if (stale.length)
      await this.redis.srem(`user-sessions:${userId}`, ...stale);

    return sessions.sort(
      (a, b) => +new Date(b.createdAt ?? 0) - +new Date(a.createdAt ?? 0),
    );
  }

  async revokeSession(userId: string, jti: string) {
    const isOwn = await this.redis.sismember(`user-sessions:${userId}`, jti);
    if (!isOwn) {
      RpcExceptionHelper.notFound('Session');
    }
    await this.redis
      .multi()
      .del(`session:${jti}`)
      .srem(`user-sessions:${userId}`, jti)
      .exec();

    return { message: 'Session revoked successfully' };
  }

  async deleteSession(jti: string, userId: string): Promise<void> {
    await this.redis
      .multi()
      .del(`session:${jti}`)
      .srem(`user-sessions:${userId}`, jti)
      .exec();
  }

  async logoutSession(jti: string, userId: string) {
    if (!jti || !userId) {
      RpcExceptionHelper.unauthorized('Invalid session');
    }

    try {
      await this.redis
        .multi()
        .del(`session:${jti}`)
        .srem(`user-sessions:${userId}`, jti)
        .exec();
    } catch {
      RpcExceptionHelper.internalServerError('Could not logout session');
    }

    return { message: 'Session logged out successfully' };
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

  async logoutAllSessionsExcept(userId: string, exceptJti: string) {
    const jtis = await this.redis.smembers(`user-sessions:${userId}`);
    const toDelete = jtis.filter((jti) => jti !== exceptJti);

    if (toDelete.length) {
      const multi = this.redis.multi();
      toDelete.forEach((jti) => multi.del(`session:${jti}`));
      multi.srem(`user-sessions:${userId}`, ...toDelete); // el actual queda en el set
      await multi.exec();
    }
  }

  async savePendingEmailChange(
    userId: string,
    newEmail: string,
    code: string,
    ttl = 60 * 15,
  ) {
    await this.redis.set(
      `change-email-pending:${userId}`,
      JSON.stringify({ newEmail, code }),
      'EX',
      ttl,
    );
  }

  async getPendingEmailChange(
    userId: string,
  ): Promise<{ newEmail: string; code: string } | null> {
    const raw = await this.redis.get(`change-email-pending:${userId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async incrementChangeEmailAttempts(
    userId: string,
    ttl = 60 * 15,
  ): Promise<number> {
    const key = `change-email-attempts:${userId}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) await this.redis.expire(key, ttl);
    return attempts;
  }

  async clearPendingEmailChange(userId: string) {
    await this.redis.del(
      `change-email-pending:${userId}`,
      `change-email-attempts:${userId}`,
    );
  }
}
