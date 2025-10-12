import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AUTH_PATTERNS } from './patterns/auth_patterns';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChangePasswordDto } from 'src/user/dto/change-password.dto';
import { LoginDto } from 'src/user/dto/login.dto';
import { RegisterUserDto } from 'src/user/dto/register-user.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService
  ) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER_USER)
  register(@Payload() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload('id') id: string,
    @Payload('email') email: string,
    @Payload('data') data: ChangePasswordDto,
  ) {
    return this.authService.changePassword(id, email, data);
  }

  @MessagePattern(AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @MessagePattern(AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload('token') token: string, @Payload('password') password: string) {
    return this.authService.resetPassword(token, password);
  }
}
