import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import {
  JwtPayload,
  PlatformRolesEnum,
  TokenTypeEnum,
} from 'src/common/interfaces/jwt-payload.interface';
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
import {
  AUTHZ_PATTERNS,
  SAAS_MAILER_PATTERNS,
} from './patterns/saas-auth.patterns';
import { GoogleOAuthService } from '../oauth/google-oauth.service';
import { JwtToken } from 'src/jwt-provider/enum/jwt-token.enum';
//DTOs
import { RegisterUserDto } from './dto/saas-register-user.dto';
import { LoginDto } from './dto/saas-login.dto';
import { ChangePasswordDto } from './dto/saas-change-password.dto';
import { ForgotPasswordDto } from './dto/saas-forgot-password.dto';
import { VerifyEmailDto } from './dto/saas-verify-email.dto';
import { ResendVerificationDto } from './dto/saas-resend-verification.dto';
import { GoogleAuthDto } from './dto/saas-google-auth.dto';
import { ResetPasswordDto } from './dto/saas-reset-password.dto';
import { ClientInfo } from 'src/session/interfaces/session-data.interface';
import { SaasAuthErrorCode } from './enums/saas-auth-error-code.enum';
import { UserAuthzRefreshReason } from './enums/user_authz_refresh_reason.enum';
import { ChangeEmailRequestDto } from './dto/saas-change-email-request.dto';
import { ChangeEmailConfirmDto } from './dto/saas-change-email-confirm.dto';

@Injectable()
export class SaaSAuthService {
  private readonly logger = new Logger(SaaSAuthService.name);
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly MAX_RESET_ATTEMPTS = 5;
  private readonly VERIFY_CODE_TTL = 60 * 15;
  private readonly RESET_PASSWORD_CODE_TTL = 60 * 15;
  private readonly MAX_CHANGE_EMAIL_ATTEMPTS = 5;
  private readonly CHANGE_EMAIL_CODE_TTL = 60 * 15;
  constructor(
    @Inject(JwtToken.REFRESH) private readonly jwtRefresh: JwtService,

    @InjectRepository(SaasUser)
    private readonly userRepository: Repository<SaasUser>,
    private readonly sessionService: SessionService,
    private oAuthClient: GoogleOAuthService,
    // Events
    @Inject(NOTIFICATIONS_EVENTS_CLIENT)
    private readonly eventsClient: ClientProxy,
    @Inject(AUTHZ_EVENTS_CLIENT)
    private readonly authzClient: ClientProxy,
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
        email: email.toLowerCase(),
        name,
      });

      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

      await this.sessionService.saveVerifyEmailCode(
        newUser.id,
        code,
        this.VERIFY_CODE_TTL,
      );

      // Send verification email
      this.eventsClient.emit(SAAS_MAILER_PATTERNS.VERIFY_EMAIL_SAAS, {
        email: newUser.email,
        code,
        expirationMinutes: String(this.VERIFY_CODE_TTL / 60),
      });

      return {
        message: 'Register success',
      };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase();

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      RpcExceptionHelper.badRequestException('Invalid or expired code');
    }

    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }

    const storedCode = await this.sessionService.getVerifyEmailCode(user.id);
    if (!storedCode) {
      RpcExceptionHelper.badRequestException('Code expired, request a new one');
    }

    if (storedCode !== dto.code) {
      const attempts = await this.sessionService.incrementVerifyAttempts(
        user.id,
      );
      if (attempts >= this.MAX_VERIFY_ATTEMPTS) {
        await this.sessionService.clearVerifyEmailCode(user.id); // quema el código
        RpcExceptionHelper.badRequestException(
          'Too many attempts, request a new code',
        );
      }
      RpcExceptionHelper.badRequestException('Invalid code');
    }

    user.emailVerified = true;
    await this.userRepository.save(user);
    await this.sessionService.clearVerifyEmailCode(user.id);

    return { message: 'Email verified' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (user && !user.emailVerified) {
      const allowed = await this.sessionService.tryStartResendCooldown(user.id);
      if (allowed) {
        await this.issueAndSendVerificationCode(user);
      }
    }

    return {
      message:
        'If an unverified account exists for this email, a new code was sent',
    };
  }

  private async issueAndSendVerificationCode(user: SaasUser) {
    await this.sessionService.clearVerifyEmailCode(user.id);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.sessionService.saveVerifyEmailCode(
      user.id,
      code,
      this.VERIFY_CODE_TTL,
    );

    this.eventsClient.emit(SAAS_MAILER_PATTERNS.VERIFY_EMAIL_SAAS, {
      email: user.email,
      code,
      expirationMinutes: String(this.VERIFY_CODE_TTL / 60),
    });
  }

  async findUserIncludingDeleted(
    where: FindOptionsWhere<SaasUser>,
  ): Promise<SaasUser | null> {
    return await this.userRepository.findOne({
      where,
      withDeleted: true,
    });
  }

  async login(loginDto: LoginDto, clientInfo?: ClientInfo) {
    const { password, email } = loginDto;

    const userData = await this.findUserIncludingDeleted({
      email: email.toLowerCase(),
    });

    const isPasswordValid =
      !!userData?.passwordHash &&
      (await bcrypt.compare(password, userData.passwordHash));

    if (!userData || !isPasswordValid) {
      RpcExceptionHelper.unauthorized('Invalid credentials');
    }

    if (userData.deletedAt) {
      RpcExceptionHelper.forbidden('User account is deactivated', SaasAuthErrorCode.ACCOUNT_DEACTIVATED);
    }

    if (!userData.emailVerified) {
      RpcExceptionHelper.forbidden(
        'Email not verified',
        SaasAuthErrorCode.EMAIL_NOT_VERIFIED,
      );
    }

    try {
      const { passwordHash, deletedAt, updatedAt, ...safeUser } = userData;

      const jti = uuidv4();
      const accessToken = await this.sessionService.signAccessToken({
        jti,
        sub: userData.id,
        aud: 'saas',
        platformRole: PlatformRolesEnum.STAFF,
      });
      const refreshToken = await this.sessionService.signRefreshToken({
        jti,
        sub: userData.id,
        aud: 'saas',
        platformRole: PlatformRolesEnum.STAFF,
      });

      await this.sessionService.saveSession({
        jti,
        data: { userId: userData.id },
        ttl: 60 * 60 * 24 * 7,
        clientInfo,
      });

      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId: userData.id,
        reason: UserAuthzRefreshReason.LOGIN,
      });

      return { user: safeUser, tokens: { accessToken, refreshToken } };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async refresh(incomingRefreshToken: string, clientInfo?: ClientInfo) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtRefresh.verifyAsync(incomingRefreshToken);
    } catch {
      RpcExceptionHelper.unauthorized('Invalid or expired refresh token');
    }

    if (
      !payload?.sub ||
      !payload?.jti ||
      payload.type !== TokenTypeEnum.REFRESH
    ) {
      RpcExceptionHelper.unauthorized('Invalid refresh token');
    }

    const userId = payload.sub;
    const oldJti = payload.jti;

    const session = await this.sessionService.getSession(oldJti);
    if (!session || session.userId !== userId) {
      RpcExceptionHelper.unauthorized('Refresh token revoked or already used');
    }

    await this.sessionService.deleteSession(oldJti, userId);

    const jti = uuidv4();
    const accessToken = await this.sessionService.signAccessToken({
      jti,
      sub: userId,
      aud: 'saas',
      platformRole: PlatformRolesEnum.STAFF,
    });
    const refreshToken = await this.sessionService.signRefreshToken({
      jti,
      sub: userId,
      aud: 'saas',
      platformRole: PlatformRolesEnum.STAFF,
    });

    await this.sessionService.saveSession({
      jti,
      data: { userId },
      ttl: 60 * 60 * 24 * 7,
      clientInfo,
      createdAt: session.createdAt,
    });

    this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
      userId,
      reason: UserAuthzRefreshReason.REFRESH_TOKEN,
    });

    return { accessToken, refreshToken };
  }

  async changePassword(id: string, jti: string, dto: ChangePasswordDto) {
    const user = await this.findUserIncludingDeleted({ id });

    if (!user) {
      RpcExceptionHelper.notFound('User');
    }

    const isOldValid =
      !!user.passwordHash &&
      (await bcrypt.compare(dto.oldPassword, user.passwordHash));

    if (!isOldValid) {
      RpcExceptionHelper.unauthorized('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      RpcExceptionHelper.badRequestException(
        'New password must be different from the current one',
      );
    }

    try {
      user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
      await this.userRepository.save(user);

      try {
        await this.sessionService.logoutAllSessionsExcept(user.id, jti);
      } catch (err: any) {
        this.logger.error(
          `Password changed (user=${user.id}) but session cleanup failed: ${err?.message}`,
        );
      }

      return { message: 'Password updated successfully' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.findUserIncludingDeleted({ email });

    if (user) {
      await this.issueAndSendResetCode(user);
    }

    return { message: 'If the email exists, reset instructions were sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      RpcExceptionHelper.badRequestException('Invalid or expired code');
    }

    const storedCode = await this.sessionService.getResetCode(user.id);
    if (!storedCode) {
      RpcExceptionHelper.badRequestException('Code expired, request a new one');
    }

    if (storedCode !== dto.code) {
      const attempts = await this.sessionService.incrementResetAttempts(
        user.id,
      );
      if (attempts >= this.MAX_RESET_ATTEMPTS) {
        await this.sessionService.clearResetCode(user.id);
        RpcExceptionHelper.badRequestException(
          'Too many attempts, request a new code',
        );
      }
      RpcExceptionHelper.badRequestException('Invalid code');
    }

    await this.userRepository.update(
      { id: user.id },
      { passwordHash: await bcrypt.hash(dto.password, 10) },
    );

    await this.sessionService.clearResetCode(user.id);
    await this.sessionService.logoutAllSessions(user.id);

    return { message: 'Password reset successfully' };
  }

  private async issueAndSendResetCode(user: SaasUser) {
    await this.sessionService.clearResetCode(user.id);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.sessionService.saveResetCode(user.id, code, 60 * 15);

    this.eventsClient.emit(SAAS_MAILER_PATTERNS.FORGOT_PASSWORD_SAAS, {
      email: user.email,
      code,
      expirationMinutes: String(this.RESET_PASSWORD_CODE_TTL / 60),
    });
  }

  async googleLogin(dto: GoogleAuthDto, clientInfo?: ClientInfo) {
    const payload = await this.oAuthClient.verifyIdToken(dto.idToken);

    if (!payload?.email || !payload.email_verified) {
      RpcExceptionHelper.unauthorized('Invalid Google token');
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name;

    try {
      let user = await this.findUserIncludingDeleted({ email });

      if (user?.deletedAt) {
        RpcExceptionHelper.unauthorized('Account is deactivated');
      }

      if (!user) {
        user = await this.userRepository.save({
          email,
          name,
          googleId,
          provider: 'google',
          emailVerified: true,
        });
      } else if (!user.googleId) {
        user.googleId = googleId;
        user.emailVerified = true;
        await this.userRepository.save(user);
      }

      const jti = uuidv4();
      const accessToken = await this.sessionService.signAccessToken({
        jti,
        sub: user.id,
        aud: 'saas',
        platformRole: PlatformRolesEnum.STAFF,
      });
      const refreshToken = await this.sessionService.signRefreshToken({
        jti,
        sub: user.id,
        aud: 'saas',
        platformRole: PlatformRolesEnum.STAFF,
      });

      await this.sessionService.saveSession({
        jti,
        data: { userId: user.id },
        ttl: 60 * 60 * 24 * 7,
        clientInfo,
      });

      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId: user.id,
        reason: UserAuthzRefreshReason.LOGIN,
      });

      const { passwordHash, deletedAt, updatedAt, ...safeUser } = user;
      return { user: safeUser, tokens: { accessToken, refreshToken } };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async requestEmailChange(userId: string, dto: ChangeEmailRequestDto) {
    const user = await this.findUserIncludingDeleted({ id: userId });
    if (!user) {
      RpcExceptionHelper.notFound('User');
    }

    // Cuenta solo-Google: sin passwordHash no hay re-auth posible
    if (!user.passwordHash) {
      RpcExceptionHelper.forbidden(
        'Password is required to change email for this account',
        // si tu forbidden() exige code (como en login), agregá uno al enum
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      RpcExceptionHelper.unauthorized('Invalid credentials');
    }

    const newEmail = dto.newEmail.toLowerCase();
    if (newEmail === user.email) {
      RpcExceptionHelper.badRequestException(
        'New email must be different from the current one',
      );
    }

    const taken = await this.findUserIncludingDeleted({ email: newEmail });
    if (taken) {
      RpcExceptionHelper.duplicate('Email'); // flujo autenticado → conflict directo
    }

    try {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      await this.sessionService.savePendingEmailChange(
        userId,
        newEmail,
        code,
        this.CHANGE_EMAIL_CODE_TTL,
      );

      // OTP al email NUEVO (reuso el template verde de verify)
      this.eventsClient.emit(SAAS_MAILER_PATTERNS.VERIFY_EMAIL_SAAS, {
        email: newEmail,
        code,
        expirationMinutes: String(this.CHANGE_EMAIL_CODE_TTL / 60),
      });

      return { message: 'Verification code sent to the new email' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async confirmEmailChange(
    userId: string,
    jti: string,
    dto: ChangeEmailConfirmDto,
  ) {
    const pending = await this.sessionService.getPendingEmailChange(userId);
    if (!pending) {
      RpcExceptionHelper.badRequestException('Invalid or expired code');
    }

    if (pending.code !== dto.code) {
      const attempts =
        await this.sessionService.incrementChangeEmailAttempts(userId);
      if (attempts >= this.MAX_CHANGE_EMAIL_ATTEMPTS) {
        await this.sessionService.clearPendingEmailChange(userId);
        RpcExceptionHelper.badRequestException(
          'Too many attempts, request a new code',
        );
      }
      RpcExceptionHelper.badRequestException('Invalid code');
    }

    const newEmail = pending.newEmail;
    const user = await this.findUserIncludingDeleted({ id: userId });
    if (!user) {
      RpcExceptionHelper.notFound('User');
    }
    const oldEmail = user.email;

    try {
      user.email = newEmail;
      user.emailVerified = true;
      await this.userRepository.save(user);

      await this.sessionService.clearPendingEmailChange(userId);

      this.eventsClient.emit(SAAS_MAILER_PATTERNS.EMAIL_CHANGED_SAAS, {
        email: oldEmail,
        newEmail,
      });

      try {
        await this.sessionService.logoutAllSessionsExcept(userId, jti);
      } catch (err: any) {
        this.logger.error(
          `Email changed (user=${userId}) but session cleanup failed: ${err?.message}`,
        );
      }

      return { message: 'Email updated successfully' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
}
