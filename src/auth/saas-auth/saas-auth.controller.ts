import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SAAS_AUTH_PATTERNS } from './patterns/saas-auth.patterns';
import { RegisterUserDto } from './dto/saas-register-user.dto';
import { LoginDto } from './dto/saas-login.dto';
import { SaaSAuthService } from './saas-auth.service';
import { ChangePasswordDto } from './dto/saas-change-password.dto';
import { ForgotPasswordDto } from './dto/saas-forgot-password.dto';
import { VerifyEmailDto } from './dto/saas-verify-email.dto';
import { ResendVerificationDto } from './dto/saas-resend-verification.dto';
import { GoogleAuthDto } from './dto/saas-google-auth.dto';
import { ResetPasswordDto } from './dto/saas-reset-password.dto';
import { ClientInfo } from 'src/session/interfaces/session-data.interface';
import { ChangeEmailRequestDto } from './dto/saas-change-email-request.dto';
import { ChangeEmailConfirmDto } from './dto/saas-change-email-confirm.dto';

@Controller()
export class SaaSAuthController {
  constructor(private readonly service: SaaSAuthService) {}

  @MessagePattern(SAAS_AUTH_PATTERNS.REGISTER)
  register(@Payload() registerUserDto: RegisterUserDto) {
    return this.service.register(registerUserDto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.VERIFY_EMAIL)
  verifyEmail(@Payload() dto: VerifyEmailDto) {
    return this.service.verifyEmail(dto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.RESEND_VERIFICATION)
  resendVerification(@Payload() dto: ResendVerificationDto) {
    return this.service.resendVerification(dto);
  }
  @MessagePattern(SAAS_AUTH_PATTERNS.LOGIN)
  login(
    @Payload('credentials') dto: LoginDto,
    @Payload('clientInfo') clientInfo: ClientInfo,
  ) {
    return this.service.login(dto, clientInfo);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.REFRESH)
  refresh(
    @Payload('refreshToken') refreshToken: string,
    @Payload('clientInfo') clientInfo: ClientInfo,
  ) {
    return this.service.refresh(refreshToken, clientInfo);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.GOOGLE_AUTH)
  googleLogin(
    @Payload('credentials') dto: GoogleAuthDto,
    @Payload('clientInfo') clientInfo: ClientInfo,
  ) {
    return this.service.googleLogin(dto, clientInfo);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload('id') id: string,
    @Payload('jti') jti: string,
    @Payload('data') data: ChangePasswordDto,
  ) {
    return this.service.changePassword(id, jti, data);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.service.forgotPassword(dto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.CHANGE_EMAIL_REQUEST)
  requestEmailChange(
    @Payload('id') id: string,
    @Payload('data') data: ChangeEmailRequestDto,
  ) {
    return this.service.requestEmailChange(id, data);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.CHANGE_EMAIL_CONFIRM)
  confirmEmailChange(
    @Payload('id') id: string,
    @Payload('jti') jti: string,
    @Payload('data') data: ChangeEmailConfirmDto,
  ) {
    return this.service.confirmEmailChange(id, jti, data);
  }
}
