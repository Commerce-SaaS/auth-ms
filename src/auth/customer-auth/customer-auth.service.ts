import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import { envs } from 'src/config';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
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
import { UserAuthzRefreshReason } from '../shared/enums/user_authz_refresh_reason.enum';
import { LoginDto } from '../shared/dto/login.dto';
import { ChangePasswordDto } from '../shared/dto/change-password.dto';
import { ForgotPasswordDto } from '../shared/dto/forgot-password.dto';
import { ResetPasswordDto } from '../shared/dto/reset-password.dto';
import { Customer } from 'src/customer/entities/customer.entity';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { PlatformRolesEnum } from '../shared/enums/platform-roles.enum';
import { GoogleAuthDto } from '../shared/dto/google-auth.dto';
import { GoogleOAuthService } from '../oauth/google-oauth.service';

/**
 * Servicio de autenticación para clientes.
 * Gestiona el registro, inicio de sesión, renovación de tokens y recuperación de contraseñas.
 * Integra JWT, Redis, microservicios de eventos y OAuth de Google.
 */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('JWT_REFRESH') private readonly jwtRefreshService: JwtService,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly sessionService: SessionService,
    @Inject(NOTIFICATIONS_EVENTS_CLIENT)
    private readonly eventsClient: ClientProxy,
    @Inject(AUTHZ_EVENTS_CLIENT)
    private readonly authzClient: ClientProxy,

    private oAuthClient: GoogleOAuthService,
  ) {}

  /**
   * Registra un nuevo cliente en el sistema.
   * @param {RegisterCustomerDto} dto - Datos de registro del cliente (email, contraseña, nombre, etc.)
   * @returns {Promise<{user: Customer, tokens: {accessToken: string, refreshToken: string}}>}
   * - user: Datos del cliente registrado (sin contraseña)
   * - tokens: JWT de acceso y refresco
   * @throws {RpcException} Si el email ya está registrado o hay error en la base de datos
   * 
   * Flujo:
   * 1. Valida que el email no exista
   * 2. Encripta la contraseña con bcrypt (10 rounds)
   * 3. Guarda el cliente en la base de datos
   * 4. Genera tokens JWT (acceso y refresco)
   * 5. Guarda la sesión en Redis con TTL de 24h
   * 6. Emite evento para enviar email de verificación
   * 7. Emite evento de refresco de autorización
   */
  async register(dto: RegisterCustomerDto) {
    const { password, email, organizationId } = dto;

    const user = await this.findUserIncludingDeleted({
      email: email.toLowerCase(),
    });

    if (user) {
      RpcExceptionHelper.duplicate('User');
    }
    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await this.customerRepository.save({
        passwordHash,
        ...dto,
      });

      const { passwordHash: _, deletedAt, updatedAt, ...rest } = newUser;

      const jti = uuidv4();

      const { accessToken, refreshToken } =
        await this.sessionService.signAuthTokens({
          jti,
          sub: newUser.id,
          platformRole: PlatformRolesEnum.CUSTOMER,
        });

      // Save session redis
      const sessionData = {
        jti,
        data: { userId: rest.id },
        ttl: 60 * 60 * 24,
      };
      await this.sessionService.saveSession(sessionData);

      // Send verification email
      this.eventsClient.emit(CUSTOMER_MAILER_PATTERNS.VERIFY_EMAIL, {
        email: newUser.email,
        verifyUrl: `${envs.verifyEmailUrl}?token=${accessToken}`,
      });

      // Emit authz event
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId: newUser.id,
        organizationId,
        reason: UserAuthzRefreshReason.REGISTER_CUSTOMER,
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

  /**
   * Inicia sesión de un cliente existente.
   * @param {LoginDto} loginDto - Email y contraseña del cliente
   * @returns {Promise<{user: Customer, tokens: {accessToken: string, refreshToken: string}}>}
   * @throws {RpcException} Si el usuario no existe, cuenta desactivada o credenciales inválidas
   * 
   * Flujo:
   * 1. Busca el cliente por email (incluyendo eliminados)
   * 2. Valida que la cuenta no esté desactivada (deletedAt)
   * 3. Verifica la contraseña con bcrypt
   * 4. Genera nuevos tokens JWT
   * 5. Guarda sesión en Redis (TTL 24h)
   * 6. Emite evento de refresco de autorización
   */
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
          platformRole: PlatformRolesEnum.CUSTOMER,
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

  /**
   * Autentica un cliente usando Google OAuth.
   * @param {GoogleAuthDto} dto - ID token de Google y organizationId
   * @returns {Promise<{user: Customer, tokens: {accessToken: string, refreshToken: string}}>}
   * @throws {RpcException} Si el token es inválido
   * 
   * Flujo:
   * 1. Verifica el ID token de Google
   * 2. Si no existe cliente con ese email, lo crea automáticamente
   * 3. Si ya existe, usa la información existente
   * 4. Genera tokens JWT
   * 5. Guarda sesión en Redis (TTL 24h)
   * 6. Emite evento de refresco de autorización
   * 
   * Nota: Google Auth marca el email como verificado automáticamente
   */
  async googleLogin(dto: GoogleAuthDto) {
    const payload = await this.oAuthClient.verifyIdToken(dto.idToken);

    if (!payload) {
      RpcExceptionHelper.unauthorized('Invalid Google token');
    }

    const email = payload.email;
    const googleId = payload.sub;
    const name = payload.name;

    let customer = await this.customerRepository.findOne({
      where: { email },
    });

    if (!customer) {
      customer = await this.customerRepository.save({
        email,
        name,
        googleId,
        organizationId: dto.organizationId,
        provider: 'google',
        emailVerified: true,
      });
    }

    const jti = uuidv4();
    const { accessToken, refreshToken } =
      await this.sessionService.signAuthTokens({
        jti,
        sub: customer.id,
        platformRole: PlatformRolesEnum.CUSTOMER,
      });

    // Save session in Redis
    const sessionData = {
      jti,
      data: { userId: customer.id },
      ttl: 60 * 60 * 24,
    };
    await this.sessionService.saveSession(sessionData);

    // Emit authz event
    this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
      userId: customer.id,
      reason: UserAuthzRefreshReason.LOGIN,
    });

    const {
      passwordHash,
      deletedAt,
      updatedAt,
      organizationId,
      createdAt,
      googleId: google,
      ...rest
    } = customer;

    return {
      user: rest,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Renueva el token de acceso usando un refresh token.
   * @param {string} incomingRefreshToken - Token de refresco actual
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   * @throws {RpcException} Si el refresh token es inválido, expirado o no tiene payload válido
   * 
   * Flujo:
   * 1. Verifica el refresh token
   * 2. Extrae el userId del payload
   * 3. Genera nuevos tokens de acceso y refresco
   * 4. Guarda nueva sesión en Redis (TTL 15 min)
   * 5. Emite evento de refresco de autorización
   */
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
          platformRole: PlatformRolesEnum.CUSTOMER,
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

  /**
   * Cambia la contraseña de un cliente autenticado.
   * @param {string} id - ID del cliente
   * @param {ChangePasswordDto} dto - Contraseña antigua y nueva
   * @returns {Promise<{message: string}>}
   * @throws {RpcException} Si el usuario no existe o la contraseña antigua es incorrecta
   * 
   * Flujo:
   * 1. Busca el cliente por ID
   * 2. Valida la contraseña antigua mediante re-autenticación
   * 3. Encripta la nueva contraseña
   * 4. Actualiza en la base de datos
   * 
   * Nota: Requiere que el cliente esté autenticado
   */
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

      await this.customerRepository.save(user);

      return {
        message: 'Password updated successfully',
      };
    } catch (error) {
      throw RpcExceptionHelper.handle(error);
    }
  }

  /**
   * Inicia el proceso de recuperación de contraseña.
   * @param {ForgotPasswordDto} dto - Email del cliente
   * @returns {Promise<{message: string}>}
   * 
   * Flujo:
   * 1. Busca el cliente por email
   * 2. Invalida todos los tokens de refresco anteriores
   * 3. Genera un nuevo reset token con JTI único
   * 4. Emite evento para enviar email con enlace de reseteo
   * 
   * Nota: Retorna mensaje genérico por seguridad (no revela si el email existe)
   * El reset token tiene expiración y se consume al usarlo
   */
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
      platformRole: PlatformRolesEnum.CUSTOMER,
    });

    this.eventsClient.emit(CUSTOMER_MAILER_PATTERNS.FORGOT_PASSWORD, {
      email: user.email,
      resetUrl: `${envs.resetPasswordUrl}?token=${resetToken}`,
    });

    return { message: 'If the email exists, reset instructions were sent' };
  }

  /**
   * Resetea la contraseña usando un reset token válido.
   * @param {ResetPasswordDto} dto - Reset token y nueva contraseña
   * @returns {Promise<{message: string}>}
   * @throws {RpcException} Si el token es inválido, expirado, o consumido
   * 
   * Flujo:
   * 1. Verifica el reset token con secreto especial
   * 2. Valida estructura del payload (sub, jti, type='reset')
   * 3. Consume el token desde Redis
   * 4. Valida que el userId coincida
   * 5. Encripta la nueva contraseña
   * 6. Actualiza en la base de datos
   * 7. Invalida todos los reset tokens del usuario
   * 
   * Nota: El token solo se puede usar una vez (consumido en Redis)
   */
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

      const result = await this.customerRepository.update(
        {
          id: payload.sub,
        },
        {
          passwordHash: newHashedPassword,
        },
      );

      if (!result.affected) {
        RpcExceptionHelper.notFound('Customer');
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

  /**
   * Busca un cliente en la base de datos incluyendo los eliminados lógicamente.
   * @param {FindOptionsWhere<Customer>} where - Condiciones de búsqueda (por id, email, etc.)
   * @returns {Promise<Customer | null>} Cliente encontrado o null
   * 
   * Nota: Utiliza withDeleted: true para incluir clientes con deletedAt != null
   * Usado en login y forgotPassword para permitir operaciones incluso con cuentas desactivadas
   */
  async findUserIncludingDeleted(
    where: FindOptionsWhere<Customer>,
  ): Promise<Customer | null> {
    return await this.customerRepository.findOne({
      where,
      withDeleted: true,
    });
  }
}
