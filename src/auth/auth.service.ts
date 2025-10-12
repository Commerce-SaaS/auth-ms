import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { UserService } from 'src/user/user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import { envs } from 'src/config';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';
import { JwtData } from 'src/common/interfaces/jwt-data.interface';
import { v4 as uuidv4 } from 'uuid';

import * as bcrypt from 'bcrypt';
import { User } from 'src/user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from 'src/session/session.service';
import { CustomMailerService } from 'src/custom-mailer/custom-mailer.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('JWT_REFRESH') private readonly jwtRefreshService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly sessionService: SessionService,
    private readonly customMailerService: CustomMailerService,
  ) {}

  async signTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const accessToken = await this.jwtService.signAsync(payload, {
        secret: envs.accessTokensecret,
        expiresIn: '15m',
      });

      const refreshToken = await this.jwtRefreshService.signAsync(payload, {
        secret: envs.refreshTokenSecret,
        expiresIn: '7d',
      });

      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Error generating tokens:', error);
      RpcExceptionHelper.internalServerError('Could not generate tokens');
    }
  }

  async register(registerUserDto: RegisterUserDto) {
    const { password, email, name } = registerUserDto;

    try {
      // 1# Validate if user exists
      const userData = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      });

      if (userData) {
        RpcExceptionHelper.duplicate('User');
      }
      // 2# Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // 3# Save user
      const newUser = await this.userRepository.save({
        passwordHash,
        email,
        name,
      });

      // 4# Generete tokens
      const { passwordHash: _, ...rest } = newUser;

      const jti = uuidv4();

      const { accessToken, refreshToken } = await this.signTokens({
        jti,
        sub: newUser.id,
        email: newUser.email,
      });

      // 5# Save session redis
      const sessionData = {
        jti,
        data: { userId: rest.id },
        ttl: 60 * 15,
      };
      await this.sessionService.saveSession(sessionData);

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

  async login(loginDto: LoginDto) {
    const { password, email } = loginDto;

    try {
      // 1. Find user, including soft-deleted accounts
      const userData = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
        withDeleted: true,
      });

      if (!userData) {
        RpcExceptionHelper.notFound('User');
      }

      // 2. Prevent login if the user account is soft-deleted
      if (userData.deletedAt) {
        RpcExceptionHelper.unauthorized('User account is deactivated');
      }

      // 3. Validate password
      const isPasswordValid = await bcrypt.compare(
        password,
        userData.passwordHash,
      );
      if (!isPasswordValid) {
        RpcExceptionHelper.unauthorized('Invalid credentials');
      }

      // 4. Prepare clean payload (exclude password and unnecessary timestamps)
      const { passwordHash, deletedAt, updatedAt, ...safeUser } = userData;

      // 5. Generate tokens
      const jti = uuidv4();
      const { accessToken, refreshToken } = await this.signTokens({
        jti,
        sub: userData.id,
        email: userData.email,
      });

      // 6. Save session in Redis
      const sessionData = {
        jti,
        data: { userId: safeUser.id },
        ttl: 60 * 15,
      };
      await this.sessionService.saveSession(sessionData);

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

  async refresh(incomingRefreshToken: string) {
    try {
      // 1# Verify refresh token
      const payload =
        await this.jwtRefreshService.verifyAsync(incomingRefreshToken);

      if (!payload?.sub || !payload?.email) {
        RpcExceptionHelper.unauthorized('Invalid refresh token payload');
      }

      // 2# Extract user data
      const { sub: userId, email } = payload;

      // 3# Generate new tokens
      const jti = uuidv4();

      const { accessToken, refreshToken } = await this.signTokens({
        jti,
        sub: userId,
        email,
      });

      // 4# Save session on redis
      const sessionData = {
        jti,
        data: { userId: userId },
        ttl: 60 * 15,
      };
      await this.sessionService.saveSession(sessionData);

      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      RpcExceptionHelper.unauthorized('Invalid or expired refresh token');
    }
  }

  async changePassword(
    id: string,
    email: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    try {
      await this.login({ email, password: changePasswordDto.oldPassword });

      // 1# Hash new password
      const newHashedPassword = await bcrypt.hash(
        changePasswordDto.newPassword,
        10,
      );

      // 2# Update user password
      await this.userRepository.update(id, { passwordHash: newHashedPassword });

      // 3# Return updated user data (excluding password)
      const updatedUser = await this.userRepository.findOneBy({ id });
      if (!updatedUser) {
        RpcExceptionHelper.notFound('User');
      }

      const { passwordHash, ...secureUser } = updatedUser;

      return { message: 'Password changed successfully', user: secureUser };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async forgotPassword(email: string) {
    try {
      // 1# Check if user exists
      const user = await this.userRepository.findOneBy({ email });
      if (!user) {
        RpcExceptionHelper.notFound('User');
      }

      // 2# Generate tokens
      const jti = uuidv4();
      const { accessToken } = await this.signTokens({
        jti,
        sub: user.id,
        email: user.email,
      });

      // 3# Send email
      await this.customMailerService.sendForgotPasswordEmail(
        email,
        `${envs.resetPasswordUrl}?token=${accessToken}`,
      );
      return { message: 'Password reset email sent' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async resetPassword(token: string, password: string) {
    try {
      // 1# Verify token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: envs.accessTokensecret,
      });
      if (!payload?.sub || !payload?.email) {
        RpcExceptionHelper.unauthorized('Invalid token payload');
      }
      // 2# Hash new password
      const newHashedPassword = await bcrypt.hash(password, 10);
      // 3# Update user password
      await this.userRepository.update(payload.sub, {
        passwordHash: newHashedPassword,
      });
      return { message: 'Password reset successfully' };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    } 
  }
}
