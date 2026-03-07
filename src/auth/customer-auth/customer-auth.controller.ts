import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerAuthService } from './customer-auth.service';
import { CUSTOMER_AUTH_PATTERNS } from './patterns/customer-auth.patterns';
import { RegisterUserDto } from '../shared/dto/register-user.dto';
import { LoginDto } from '../shared/dto/login.dto';
import { ChangePasswordDto } from '../shared/dto/change-password.dto';
import { ForgotPasswordDto } from '../shared/dto/forgot-password.dto';
import { ResetPasswordDto } from '../shared/dto/reset-password.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';


@Controller()
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService
  ) {}

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.REGISTER)
  register(@Payload() registerCustomerDto: RegisterCustomerDto) {
    return this.customerAuthService.register(registerCustomerDto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.LOGIN)
  login(@Payload() loginDto: LoginDto) {
    return this.customerAuthService.login(loginDto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.REFRESH)
  refresh(@Payload() refreshToken: string) {
    return this.customerAuthService.refresh(refreshToken);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload('id') id: string,
    @Payload('data') data: ChangePasswordDto,
  ) {
    return this.customerAuthService.changePassword(id, data);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.customerAuthService.forgotPassword(dto);
  }

  @MessagePattern(CUSTOMER_AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.customerAuthService.resetPassword(dto);
  }
}
