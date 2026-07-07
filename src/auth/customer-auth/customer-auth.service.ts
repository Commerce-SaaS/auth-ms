import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
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
  CUSTOMER_MAILER_PATTERNS,
} from './patterns/customer-auth.patterns';
import { UserAuthzRefreshReason } from '../saas-auth/enums/user_authz_refresh_reason.enum';

import { Customer } from 'src/customer/entities/customer.entity';

import { GoogleOAuthService } from '../oauth/google-oauth.service';
import {
  JwtPayload,
  PlatformRolesEnum,
  TokenTypeEnum,
} from 'src/common/interfaces/jwt-payload.interface';

import { SaasAuthErrorCode } from '../saas-auth/enums/saas-auth-error-code.enum';

import { ChangePasswordDto } from './dto/customer-change-password.dto';
import { RegisterCustomerDto } from './dto/customer-register-customer.dto';
import { GoogleAuthDto } from './dto/customer-google-auth.dto';
import {
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/customer-verify-email.dto';
import { ForgotPasswordDto } from './dto/customer-forgot-password.dto';
import { ResetPasswordDto } from './dto/customer-reset-password.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { ChangeEmailConfirmDto } from './dto/customer-change-email-confirm.dto';
import { ChangeEmailRequestDto } from './dto/customer-change-email-request.dto';

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);
  private readonly MAX_RESET_ATTEMPTS = 5;
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly MAX_CHANGE_EMAIL_ATTEMPTS = 5;
  private readonly CHANGE_EMAIL_CODE_TTL = 60 * 15;

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly sessionService: SessionService,
    private oAuthClient: GoogleOAuthService,

    // Events
    @Inject(NOTIFICATIONS_EVENTS_CLIENT)
    private readonly eventsClient: ClientProxy,
    @Inject(AUTHZ_EVENTS_CLIENT)
    private readonly authzClient: ClientProxy,
  ) { }

  async register(dto: RegisterCustomerDto) {
    const { password, email, name, organizationId, logoUrl, orgName } = dto;

    const user = await this.findUserIncludingDeleted({
      email: email.toLowerCase(),
      organizationId,
    });

    if (user) {
      RpcExceptionHelper.duplicate('User');
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await this.customerRepository.save({
        passwordHash,
        email: email.toLowerCase(),
        name,
        organizationId,
      });

      this.logger.log(
        `[AUTHZ-FLOW] register: userId=${newUser.id} organizationId=${organizationId} — verification email queued, authz deferred to verifyEmail`,
      );

      await this.issueAndSendVerificationCode({
        customerId: newUser.id,
        email: newUser.email,
        logoUrl,
        orgName,
      });

      return { message: 'Register success' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async login(dto: CustomerLoginDto) {
    const { password, email, organizationId } = dto;

    const userData = await this.findUserIncludingDeleted({
      email: email.toLowerCase(),
      organizationId,
    });

    const isPasswordValid =
      !!userData?.passwordHash &&
      (await bcrypt.compare(password, userData.passwordHash));

    if (!userData || !isPasswordValid) {
      RpcExceptionHelper.unauthorized('Invalid credentials');
    }

    if (userData.deletedAt) {
      RpcExceptionHelper.unauthorized('User account is deactivated');
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
        aud: 'customer',
        platformRole: PlatformRolesEnum.STAFF,
      });
      const refreshToken = await this.sessionService.signRefreshToken({
        jti,
        sub: userData.id,
        aud: 'customer',
        platformRole: PlatformRolesEnum.STAFF,
      });
      await this.sessionService.saveSession({
        jti,
        data: { userId: userData.id },
        ttl: 60 * 60 * 24 * 7, // 7d
      });

      const loginAuthzPayload = {
        userId: userData.id,
        organizationId,
        reason: UserAuthzRefreshReason.LOGIN,
      };
      this.logger.log(
        `[AUTHZ-FLOW] login: emitting user_authz_refresh userId=${loginAuthzPayload.userId} organizationId=${loginAuthzPayload.organizationId} reason=${loginAuthzPayload.reason}`,
      );
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, loginAuthzPayload);

      return { user: safeUser, tokens: { accessToken, refreshToken } };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async googleLogin(dto: GoogleAuthDto) {
    const { organizationId } = dto;

    let payload;
    try {
      payload = await this.oAuthClient.verifyIdToken(dto.idToken);
    } catch {
      RpcExceptionHelper.unauthorized('Invalid Google token');
    }

    if (!payload?.email || payload.email_verified !== true) {
      RpcExceptionHelper.unauthorized('Invalid Google token');
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name;

    try {
      let reason: UserAuthzRefreshReason = UserAuthzRefreshReason.LOGIN;

      let customer = await this.customerRepository.findOne({
        where: { email, organizationId },
        withDeleted: true,
      });

      if (customer?.deletedAt) {
        RpcExceptionHelper.forbidden('Account deactivated');
      }

      if (!customer) {
        customer = await this.customerRepository.save({
          email,
          name,
          googleId,
          organizationId,
          provider: 'google',
          emailVerified: true,
        });
        reason = UserAuthzRefreshReason.REGISTER_CUSTOMER;
      } else if (!customer.googleId) {
        // linking: cuenta existente por password → vincular Google
        customer.googleId = googleId;
        customer.emailVerified = true;
        await this.customerRepository.save(customer);
      }

      this.logger.log(
        `[AUTHZ-FLOW] googleLogin: userId=${customer.id} organizationId=${organizationId} isNewCustomer=${reason === UserAuthzRefreshReason.REGISTER_CUSTOMER}`,
      );

      const jti = uuidv4();
      const accessToken = await this.sessionService.signAccessToken({
        jti,
        sub: customer.id,
        aud: 'customer',
        platformRole: PlatformRolesEnum.STAFF,
      });
      const refreshToken = await this.sessionService.signRefreshToken({
        jti,
        sub: customer.id,
        aud: 'customer',
        platformRole: PlatformRolesEnum.STAFF,
      });

      await this.sessionService.saveSession({
        jti,
        data: { userId: customer.id },
        ttl: 60 * 60 * 24 * 7, // 7d
      });

      const googleAuthzPayload = { userId: customer.id, organizationId, reason };
      this.logger.log(
        `[AUTHZ-FLOW] googleLogin: emitting user_authz_refresh userId=${googleAuthzPayload.userId} organizationId=${googleAuthzPayload.organizationId} reason=${googleAuthzPayload.reason}`,
      );
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, googleAuthzPayload);

      const {
        passwordHash,
        deletedAt,
        updatedAt,
        organizationId: _o,
        createdAt,
        googleId: _g,
        ...rest
      } = customer;
      return { user: rest, tokens: { accessToken, refreshToken } };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async refresh(incomingRefreshToken: string) {
    let payload: JwtPayload;
    try {
      payload =
        await this.sessionService.verifyRefreshToken(incomingRefreshToken);
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

    // Revocabilidad + reuso
    const session = await this.sessionService.getSession(oldJti);
    if (!session || session.userId !== userId) {
      RpcExceptionHelper.unauthorized('Refresh token revoked or already used');
    }

    // Rotación estricta
    await this.sessionService.deleteSession(oldJti, userId);

    const jti = uuidv4();
    const accessToken = await this.sessionService.signAccessToken({
      jti,
      sub: userId,
      aud: 'customer',
      platformRole: PlatformRolesEnum.STAFF,
    });
    const refreshToken = await this.sessionService.signRefreshToken({
      jti,
      sub: userId,
      aud: 'customer',
      platformRole: PlatformRolesEnum.STAFF,
    });

    await this.sessionService.saveSession({
      jti,
      data: { userId },
      ttl: 60 * 60 * 24 * 7, // 7d
    });

    const refreshAuthzPayload = {
      userId,
      reason: UserAuthzRefreshReason.REFRESH_TOKEN,
    };
    this.logger.log(
      `[AUTHZ-FLOW] refresh: emitting user_authz_refresh userId=${refreshAuthzPayload.userId} reason=${refreshAuthzPayload.reason}`,
    );
    this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, refreshAuthzPayload);

    return { tokens: { accessToken, refreshToken } };
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
      await this.customerRepository.save(user);

      try {
        await this.sessionService.logoutAllSessionsExcept(user.id, jti);
      } catch (err: any) {
        this.logger.error(
          `Password changed (customer=${user.id}) but session cleanup failed: ${err?.message}`,
        );
      }

      return { message: 'Password updated successfully' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase();
    const { organizationId, logoUrl, orgName } = dto;

    const user = await this.findUserIncludingDeleted({ email, organizationId });

    if (user) {
      await this.issueAndSendResetCode({
        email,
        customerId: user.id,
        logoUrl,
        orgName,
      });
    }

    return { message: 'If the email exists, reset instructions were sent' };
  }

  async resetPassword(dto: ResetPasswordDto & { organizationId: string }) {
    const email = dto.email.toLowerCase();
    const { code, password, organizationId } = dto;

    const user = await this.findUserIncludingDeleted({ email, organizationId });
    if (!user) {
      RpcExceptionHelper.unauthorized('Invalid or expired code');
    }

    const storedCode = await this.sessionService.getResetCode(user.id);
    if (!storedCode) {
      RpcExceptionHelper.unauthorized('Invalid or expired code');
    }

    if (storedCode !== code) {
      const attempts = await this.sessionService.incrementResetAttempts(
        user.id,
      );
      if (attempts >= this.MAX_RESET_ATTEMPTS) {
        await this.sessionService.clearResetCode(user.id); // quema el código
      }
      RpcExceptionHelper.unauthorized('Invalid or expired code');
    }

    const newHashedPassword = await bcrypt.hash(password, 10);
    await this.customerRepository.update(
      { id: user.id },
      { passwordHash: newHashedPassword },
    );

    await this.sessionService.clearResetCode(user.id);
    await this.sessionService.logoutAllSessions(user.id);

    return { message: 'Password reset successfully' };
  }

  private async issueAndSendResetCode(dto: {
    email: string;
    customerId: string;
    logoUrl: string;
    orgName: string;
  }) {
    await this.sessionService.clearResetCode(dto.customerId);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.sessionService.saveResetCode(dto.customerId, code, 60 * 15);

    this.eventsClient.emit(CUSTOMER_MAILER_PATTERNS.FORGOT_PASSWORD_CUSTOMER, {
      email: dto.email,
      code,
      logoUrl: dto.logoUrl,
      orgName: dto.orgName,
      expirationMinutes: '15',
    });
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase();
    const { code, organizationId } = dto;

    const customer = await this.customerRepository.findOne({
      where: { email, organizationId },
    });
    if (!customer) {
      RpcExceptionHelper.unauthorized('Invalid or expired code');
    }

    this.logger.log(
      `[AUTHZ-FLOW] verifyEmail: received customerId=${customer.id} organizationId=${organizationId}`,
    );

    if (customer.emailVerified) {
      return { message: 'Email already verified' };
    }

    const storedCode = await this.sessionService.getVerifyEmailCode(
      customer.id,
    );
    if (!storedCode) {
      RpcExceptionHelper.unauthorized('Invalid or expired code');
    }

    if (storedCode !== code) {
      const attempts = await this.sessionService.incrementVerifyAttempts(
        customer.id,
      );
      if (attempts >= this.MAX_VERIFY_ATTEMPTS) {
        await this.sessionService.clearVerifyEmailCode(customer.id); // quema el código
      }
      RpcExceptionHelper.unauthorized('Invalid or expired code');
    }

    await this.customerRepository.update(
      { id: customer.id },
      { emailVerified: true },
    );
    await this.sessionService.clearVerifyEmailCode(customer.id);

    const verifyAuthzPayload = {
      userId: customer.id,
      organizationId,
      reason: UserAuthzRefreshReason.REGISTER_CUSTOMER,
    };
    this.logger.log(
      `[AUTHZ-FLOW] verifyEmail: success, emitting user_authz_refresh userId=${verifyAuthzPayload.userId} organizationId=${verifyAuthzPayload.organizationId} reason=${verifyAuthzPayload.reason}`,
    );
    this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, verifyAuthzPayload);
    return { message: 'Email verified successfully' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.toLowerCase();
    const { organizationId, logoUrl, orgName } = dto;

    const customer = await this.customerRepository.findOne({
      where: { email, organizationId },
    });

    if (customer && !customer.emailVerified) {
      const canSend = await this.sessionService.tryStartResendCooldown(
        customer.id,
        60,
      ); // 60s
      if (canSend) {
        await this.issueAndSendVerificationCode({
          customerId: customer.id,
          email,
          logoUrl,
          orgName,
        });
      }
    }

    return {
      message: 'If the email exists and is unverified, a code was sent',
    };
  }

  private async issueAndSendVerificationCode(dto: {
    email: string;
    customerId: string;
    logoUrl: string;
    orgName: string;
  }) {
    await this.sessionService.clearVerifyEmailCode(dto.customerId);
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.sessionService.saveVerifyEmailCode(
      dto.customerId,
      code,
      60 * 15,
    );

    this.eventsClient.emit(CUSTOMER_MAILER_PATTERNS.VERIFY_EMAIL_CUSTOMER, {
      email: dto.email,
      code,
      logoUrl: dto.logoUrl,
      orgName: dto.orgName,
      expirationMinutes: '15',
    });
  }
  async requestEmailChange(
    customerId: string,
    dto: ChangeEmailRequestDto,
    branding: { logoUrl?: string; orgName?: string },
  ) {
    const customer = await this.findUserIncludingDeleted({ id: customerId });
    if (!customer) {
      RpcExceptionHelper.notFound('User');
    }

    if (!customer.passwordHash) {
      RpcExceptionHelper.forbidden(
        'Password is required to change email for this account',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      customer.passwordHash,
    );
    if (!isPasswordValid) {
      RpcExceptionHelper.unauthorized('Invalid credentials');
    }

    const newEmail = dto.newEmail.toLowerCase();
    if (newEmail === customer.email) {
      RpcExceptionHelper.badRequestException(
        'New email must be different from the current one',
      );
    }
    const taken = await this.findUserIncludingDeleted({
      email: newEmail,
      organizationId: customer.organizationId,
    });
    if (taken) {
      RpcExceptionHelper.duplicate('Email');
    }

    try {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      await this.sessionService.savePendingEmailChange(
        customerId,
        newEmail,
        code,
        this.CHANGE_EMAIL_CODE_TTL,
      );

      this.eventsClient.emit(CUSTOMER_MAILER_PATTERNS.VERIFY_EMAIL_CUSTOMER, {
        email: newEmail,
        code,
        logoUrl: branding.logoUrl,
        orgName: branding.orgName,
        expirationMinutes: '15',
      });

      return { message: 'Verification code sent to the new email' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async confirmEmailChange(
    customerId: string,
    jti: string,
    dto: ChangeEmailConfirmDto,
    branding: { logoUrl?: string; orgName?: string },
  ) {
    const pending = await this.sessionService.getPendingEmailChange(customerId);
    if (!pending) {
      RpcExceptionHelper.badRequestException('Invalid or expired code');
    }

    if (pending.code !== dto.code) {
      const attempts =
        await this.sessionService.incrementChangeEmailAttempts(customerId);
      if (attempts >= this.MAX_CHANGE_EMAIL_ATTEMPTS) {
        await this.sessionService.clearPendingEmailChange(customerId);
        RpcExceptionHelper.badRequestException(
          'Too many attempts, request a new code',
        );
      }
      RpcExceptionHelper.badRequestException('Invalid code');
    }

    const newEmail = pending.newEmail;
    const customer = await this.findUserIncludingDeleted({ id: customerId });
    if (!customer) {
      RpcExceptionHelper.notFound('User');
    }
    const oldEmail = customer.email;

    const taken = await this.findUserIncludingDeleted({
      email: newEmail,
      organizationId: customer.organizationId,
    });
    if (taken) {
      await this.sessionService.clearPendingEmailChange(customerId);
      RpcExceptionHelper.duplicate('Email');
    }

    try {
      await this.customerRepository.update(
        { id: customer.id },
        { email: newEmail, emailVerified: true },
      );

      await this.sessionService.clearPendingEmailChange(customerId);

      this.eventsClient.emit(CUSTOMER_MAILER_PATTERNS.EMAIL_CHANGED_CUSTOMER, {
        email: oldEmail,
        newEmail,
        logoUrl: branding.logoUrl,
        orgName: branding.orgName,
      });

      try {
        await this.sessionService.logoutAllSessionsExcept(customerId, jti);
      } catch (err: any) {
        this.logger.error(
          `Email changed (customer=${customerId}) but session cleanup failed: ${err?.message}`,
        );
      }

      return { message: 'Email updated successfully' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async findUserIncludingDeleted(
    where: FindOptionsWhere<Customer>,
  ): Promise<Customer | null> {
    return await this.customerRepository.findOne({
      where,
      withDeleted: true,
    });
  }
}
