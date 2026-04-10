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
import { GoogleAuthDto } from '../shared/dto/google-auth.dto';

/**
 * Controlador de autenticación de clientes.
 * Expone patrones de mensajes para comunicación basada en eventos (RabbitMQ/Microservicios).
 * No es un controlador REST tradicional, sino un manejador de patrones de microservicios.
 */
@Controller()
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  /**
   * Manejador para el patrón de registro de clientes.
   * @param {RegisterCustomerDto} registerCustomerDto - Datos de registro
   * @returns Resultado del servicio de registro
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.REGISTER)
  register(@Payload() registerCustomerDto: RegisterCustomerDto) {
    return this.customerAuthService.register(registerCustomerDto);
  }

  /**
   * Manejador para el patrón de inicio de sesión.
   * @param {LoginDto} loginDto - Email y contraseña
   * @returns Resultado del servicio de login
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.LOGIN)
  login(@Payload() loginDto: LoginDto) {
    return this.customerAuthService.login(loginDto);
  }

  /**
   * Manejador para renovar tokens.
   * @param {string} refreshToken - Token de refresco actual
   * @returns Nuevos tokens de acceso y refresco
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.REFRESH)
  refresh(@Payload() refreshToken: string) {
    return this.customerAuthService.refresh(refreshToken);
  }

  /**
   * Manejador para cambiar contraseña.
   * @param {string} id - ID del cliente autenticado
   * @param {ChangePasswordDto} data - Contraseña antigua y nueva
   * @returns Confirmación del cambio
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.CHANGE_PASSWORD)
  changePassword(
    @Payload('id') id: string,
    @Payload('data') data: ChangePasswordDto,
  ) {
    return this.customerAuthService.changePassword(id, data);
  }

  /**
   * Manejador para iniciar recuperación de contraseña.
   * @param {ForgotPasswordDto} dto - Email del cliente
   * @returns Mensaje de confirmación
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.FORGOT_PASSWORD)
  forgotPassword(@Payload() dto: ForgotPasswordDto) {
    return this.customerAuthService.forgotPassword(dto);
  }

  /**
   * Manejador para resetear contraseña con token válido.
   * @param {ResetPasswordDto} dto - Reset token y nueva contraseña
   * @returns Confirmación del reseteo
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.RESET_PASSWORD)
  resetPassword(@Payload() dto: ResetPasswordDto) {
    return this.customerAuthService.resetPassword(dto);
  }

  /**
   * Manejador para autenticación con Google OAuth.
   * @param {GoogleAuthDto} dto - ID token de Google
   * @returns Usuario y tokens de acceso/refresco
   */
  @MessagePattern(CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH)
  googleLogin(@Payload() dto: GoogleAuthDto) {
    return this.customerAuthService.googleLogin(dto);
  }
}
