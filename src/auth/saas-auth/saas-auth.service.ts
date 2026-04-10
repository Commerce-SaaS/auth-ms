import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import { envs } from 'src/config';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';
import { v4 as uuidv4 } from 'uuid';

import * as bcrypt from 'bcrypt';
import { SaasUser } from 'src/user/entities/saas-user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SessionService } from 'src/session/session.service';
import {
  AUTHZ_EVENTS_CLIENT,
  NOTIFICATIONS_EVENTS_CLIENT,
} from 'src/config/services';
import { ClientProxy } from '@nestjs/microservices';
import { RegisterUserDto } from '../shared/dto/register-user.dto';
import {
  AUTHZ_PATTERNS,
  SAAS_MAILER_PATTERNS,
} from './patterns/saas-auth.patterns';
import { UserAuthzRefreshReason } from '../shared/enums/user_authz_refresh_reason.enum';
import { LoginDto } from '../shared/dto/login.dto';
import { ChangePasswordDto } from '../shared/dto/change-password.dto';
import { ForgotPasswordDto } from '../shared/dto/forgot-password.dto';
import { ResetPasswordDto } from '../shared/dto/reset-password.dto';
import { PlatformRolesEnum } from '../shared/enums/platform-roles.enum';
import { GoogleAuthDto } from '../shared/dto/google-auth.dto';
import { GoogleOAuthService } from '../oauth/google-oauth.service';

@Injectable()
export class SaaSAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('JWT_REFRESH') private readonly jwtRefreshService: JwtService,
    @InjectRepository(SaasUser)
    private readonly userRepository: Repository<SaasUser>,
    private readonly sessionService: SessionService,
    @Inject(NOTIFICATIONS_EVENTS_CLIENT)
    private readonly eventsClient: ClientProxy,
    @Inject(AUTHZ_EVENTS_CLIENT)
    private readonly authzClient: ClientProxy,

    private oAuthClient: GoogleOAuthService,
  ) {}

  async register(registerUserDto: RegisterUserDto) {
    const { password, email, name } = registerUserDto;

    const user = await this.findUserIncludingDeleted({
      email: email.toLowerCase(),
    });

    if (user) {
      RpcExceptionHelper.duplicate('User');
    }
    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await this.userRepository.save({
        passwordHash,
        email,
        name,
      });

      const { passwordHash: _, deletedAt, updatedAt, ...rest } = newUser;

      const jti = uuidv4();

      const { accessToken, refreshToken } =
        await this.sessionService.signAuthTokens({
          jti,
          sub: newUser.id,
          platformRole: PlatformRolesEnum.STAFF,
        });

      // Save session redis
      const sessionData = {
        jti,
        data: { userId: rest.id },
        ttl: 60 * 60 * 24,
      };
      await this.sessionService.saveSession(sessionData);

      // Send verification email
      this.eventsClient.emit(SAAS_MAILER_PATTERNS.VERIFY_EMAIL, {
        email: newUser.email,
        verifyUrl: `${envs.verifyEmailUrl}?token=${accessToken}`,
      });

      // Emit authz event
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId: newUser.id,
        reason: UserAuthzRefreshReason.REGISTER_SAAS_USER,
      });

      return {
        user: rest,
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;

    const userData = await this.findUserIncludingDeleted({
      email: email.toLowerCase(),
    });

    if (!userData) {
      RpcExceptionHelper.notFound('User');
    }
    try {
      if (userData.deletedAt) {
        RpcExceptionHelper.unauthorized('User account is deactivated');
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        userData.passwordHash,
      );
      if (!isPasswordValid) {
        RpcExceptionHelper.unauthorized('Invalid credentials');
      }

      const { passwordHash, deletedAt, updatedAt, ...safeUser } = userData;

      const jti = uuidv4();
      const { accessToken, refreshToken } =
        await this.sessionService.signAuthTokens({
          jti,
          sub: userData.id,
          platformRole: PlatformRolesEnum.STAFF,
        });

      // Save session in Redis
      const sessionData = {
        jti,
        data: { userId: userData.id },
        ttl: 60 * 60 * 24,
      };
      await this.sessionService.saveSession(sessionData);

      // Emit authz event
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId: userData.id,
        reason: UserAuthzRefreshReason.LOGIN,
      });

      return {
        user: safeUser,
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async googleLogin(dto: GoogleAuthDto) {
    const payload = await this.oAuthClient.verifyIdToken(dto.idToken);

    if (!payload) {
      RpcExceptionHelper.unauthorized('Invalid Google token');
    }

    const email = payload.email;
    const googleId = payload.sub;
    const name = payload.name;

    let user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      user = await this.userRepository.save({
        email,
        name,
        googleId,
        provider: 'google',
        emailVerified: true,
      });
    }

    const jti = uuidv4();
    const { accessToken, refreshToken } =
      await this.sessionService.signAuthTokens({
        jti,
        sub: user.id,
        platformRole: PlatformRolesEnum.STAFF,
      });

    // Save session in Redis
    const sessionData = {
      jti,
      data: { userId: user.id },
      ttl: 60 * 60 * 24,
    };
    await this.sessionService.saveSession(sessionData);

    // Emit authz event
    this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
      userId: user.id,
      reason: UserAuthzRefreshReason.LOGIN,
    });

    const {
      passwordHash,
      deletedAt,
      updatedAt,
      createdAt,
      googleId: google,
      ...rest
    } = user;

    return {
      user: rest,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async refresh(incomingRefreshToken: string) {
    try {
      const payload =
        await this.jwtRefreshService.verifyAsync(incomingRefreshToken);

      if (!payload?.sub) {
        RpcExceptionHelper.unauthorized('Invalid refresh token payload');
      }

      const { sub: userId } = payload;

      const jti = uuidv4();

      const { accessToken, refreshToken } =
        await this.sessionService.signAuthTokens({
          jti,
          sub: userId,
          platformRole: PlatformRolesEnum.STAFF,
        });

      // Save session on redis
      const sessionData = {
        jti,
        data: { userId: userId },
        ttl: 60 * 15,
      };
      await this.sessionService.saveSession(sessionData);

      // Emit authz event
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId,
        reason: UserAuthzRefreshReason.REFRESH_TOKEN,
      });

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      RpcExceptionHelper.unauthorized('Invalid or expired refresh token');
    }
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.findUserIncludingDeleted({ id });

    if (!user) {
      RpcExceptionHelper.notFound('User');
    }

    try {
      await this.login({
        email: user.email,
        password: dto.oldPassword,
      });

      user.passwordHash = await bcrypt.hash(dto.newPassword, 10);

      await this.userRepository.save(user);

      return {
        message: 'Password updated successfully',
      };
    } catch (error) {
      throw RpcExceptionHelper.handle(error);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;
    const user = await this.findUserIncludingDeleted({ email });

    if (!user) {
      RpcExceptionHelper.notFound('User');
    }

    await this.sessionService.invalidateAllUserResetTokens(user.id);

    const jti = uuidv4();

    const { resetToken } = await this.sessionService.signResetToken({
      jti,
      sub: user.id,
      type: 'reset',
      platformRole: PlatformRolesEnum.STAFF,
    });

    this.eventsClient.emit(SAAS_MAILER_PATTERNS.FORGOT_PASSWORD, {
      email: user.email,
      resetUrl: `${envs.resetPasswordUrl}?token=${resetToken}`,
    });

    return { message: 'If the email exists, reset instructions were sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { token, password } = dto;

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: envs.resetTokenSecret,
      });

      if (!payload?.sub || !payload.jti || payload.type !== 'reset') {
        RpcExceptionHelper.unauthorized('Invalid token structure');
      }

      const userIdFromToken = await this.sessionService.consumeResetToken(
        payload.jti,
      );

      if (!userIdFromToken || userIdFromToken !== payload.sub) {
        RpcExceptionHelper.unauthorized('Invalid or expired token');
      }

      const newHashedPassword = await bcrypt.hash(password, 10);

      const result = await this.userRepository.update(
        {
          id: payload.sub,
        },
        {
          passwordHash: newHashedPassword,
        },
      );

      if (!result.affected) {
        RpcExceptionHelper.notFound('User');
      }

      await this.sessionService.invalidateAllUserResetTokens(payload.sub);

      return {
        message: 'Password reset successfully',
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        RpcExceptionHelper.unauthorized('Token has expired');
      }
      RpcExceptionHelper.handle(error);
    }
  }

  async findUserIncludingDeleted(
    where: FindOptionsWhere<SaasUser>,
  ): Promise<SaasUser | null> {
    return await this.userRepository.findOne({
      where,
      withDeleted: true,
    });
  }
}
