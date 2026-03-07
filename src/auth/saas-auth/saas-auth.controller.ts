import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SAAS_AUTH_PATTERNS } from './patterns/saas-auth.patterns';
import { RegisterUserDto } from '../shared/dto/register-user.dto';
import { LoginDto } from '../shared/dto/login.dto';
import { SaaSAuthService } from './saas-auth.service';
import { ChangePasswordDto } from '../shared/dto/change-password.dto';
import { ForgotPasswordDto } from '../shared/dto/forgot-password.dto';
import { ResetPasswordDto } from '../shared/dto/reset-password.dto';

@Controller()
export class SaaSAuthController {
  constructor(private readonly service: SaaSAuthService
  ) {}

  @MessagePattern(SAAS_AUTH_PATTERNS.REGISTER)
  register(@Payload() registerUserDto: RegisterUserDto) {
    return this.service.register(registerUserDto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.LOGIN)
  login(@Payload() loginDto: LoginDto) {
    return this.service.login(loginDto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.REFRESH)
  refresh(@Payload() refreshToken: string) {
    return this.service.refresh(refreshToken);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload('id') id: string,
    @Payload('data') data: ChangePasswordDto,
  ) {
    return this.service.changePassword(id, data);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.service.forgotPassword(dto);
  }

  @MessagePattern(SAAS_AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto);
  }
}
