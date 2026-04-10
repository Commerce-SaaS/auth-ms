import { forwardRef, Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';
import { JwtProvidersModule } from 'src/jwt-provider/jwt-provider.module';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerModule } from 'src/customer/customer.module';
import { OauthModule } from '../oauth/oauth.module';

/**
 * Módulo de autenticación de clientes.
 * 
 * Funcionalidades:
 * - Registro y login de clientes
 * - Recuperación y reset de contraseña
 * - Renovación de tokens JWT
 * - Autenticación con Google OAuth
 * - Gestión de sesiones en Redis
 * 
 * Dependencias:
 * - SessionModule: Gestión de tokens y sesiones
 * - JwtProvidersModule: Proveedores de JWT (acceso y refresco)
 * - CustomerModule: Entidad y repositorio de clientes
 * - OauthModule: Cliente OAuth de Google
 */
@Module({
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService],
  imports: [
    forwardRef(() => CustomerModule),
    SessionModule,
    JwtProvidersModule,
    OauthModule
  ],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
