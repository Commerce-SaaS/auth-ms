import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerAuthService } from './customer-auth.service';
import { CUSTOMER_AUTH_PATTERNS } from './patterns/customer-auth.patterns';
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
import { ChangeEmailRequestDto } from './dto/customer-change-email-request.dto';
import { ChangeEmailConfirmDto } from './dto/customer-change-email-confirm.dto';

@Controller()
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.REGISTER)
  register(@Payload() registerCustomerDto: RegisterCustomerDto) {
    return this.customerAuthService.register(registerCustomerDto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.LOGIN)
  login(@Payload() loginDto: CustomerLoginDto) {
    return this.customerAuthService.login(loginDto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.REFRESH)
  refresh(@Payload() refreshToken: string) {
    return this.customerAuthService.refresh(refreshToken);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload('id') id: string,
    @Payload('jti') jti: string,
    @Payload('data') data: ChangePasswordDto,
  ) {
    return this.customerAuthService.changePassword(id, jti, data);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.customerAuthService.forgotPassword(dto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.customerAuthService.resetPassword(dto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH)
  googleLogin(@Payload() dto: GoogleAuthDto) {
    return this.customerAuthService.googleLogin(dto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.VERIFY_EMAIL)
  verifyEmail(@Payload() dto: VerifyEmailDto) {
    return this.customerAuthService.verifyEmail(dto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.RESEND_VERIFICATION)
  resendVerification(@Payload() dto: ResendVerificationDto) {
    return this.customerAuthService.resendVerification(dto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.CHANGE_EMAIL_REQUEST)
  requestEmailChange(
    @Payload('id') id: string,
    @Payload('data') data: ChangeEmailRequestDto,
    @Payload('logoUrl') logoUrl: string,
    @Payload('orgName') orgName: string,
  ) {
    return this.customerAuthService.requestEmailChange(id, data, {
      logoUrl,
      orgName,
    });
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.CHANGE_EMAIL_CONFIRM)
  confirmEmailChange(
    @Payload('id') id: string,
    @Payload('jti') jti: string,
    @Payload('data') data: ChangeEmailConfirmDto,
    @Payload('logoUrl') logoUrl: string,
    @Payload('orgName') orgName: string,
  ) {
    return this.customerAuthService.confirmEmailChange(id, jti, data, {
      logoUrl,
      orgName,
    });
  }
}
