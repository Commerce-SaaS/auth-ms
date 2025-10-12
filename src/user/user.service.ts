import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { AuthService } from 'src/auth/auth.service';


@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async getProfile(id: string) {
    try {
      const user = await this.userRepository.findOneBy({ id });

      if (!user) {
        RpcExceptionHelper.notFound('User');
      }

      const { passwordHash, ...safeUser } = user;
      return safeUser;
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async update(updateUserDto: UpdateUserDto) {
    try {
      // 1# Verify if user exists
      const userUpdated = await this.userRepository.preload({
        ...updateUserDto,
        id: updateUserDto.id,
      });

      if (!userUpdated) {
        RpcExceptionHelper.badRequestExcetion(
          `User with id: ${updateUserDto.id} not found`,
        );
      }

      // 2# Save to DB
      await this.userRepository.save(userUpdated);

      const { passwordHash, ...secureUser } = userUpdated;
      // 3# Return updated user
      return secureUser;
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async softDelete(id: string) {
    try {
      // 1# Verify if user exists
      const user = await this.userRepository.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        RpcExceptionHelper.badRequestExcetion(`User with id: ${id} not found`);
      }

      if (user.deletedAt) {
        RpcExceptionHelper.badRequestExcetion(
          `User with id: ${id} already soft deleted`,
        );
      }

      // 2# Apply soft delete updates
      await this.userRepository.softDelete(id);

      return { message: `User with id: ${id} was soft deleted` };
    } catch (error) {
      console.log(error);
      RpcExceptionHelper.handle(error);
    }
  }

  async restoreUser(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      // 1. Find user including soft-deleted
      const user = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
        withDeleted: true,
      });

      if (!user) {
        throw RpcExceptionHelper.notFound('User');
      }

      // 2. Validate password BEFORE restoring
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw RpcExceptionHelper.unauthorized('Invalid credentials');
      }

      // 3. Only restore if deleted
      if (!user.deletedAt) {
        throw RpcExceptionHelper.badRequestExcetion(
          `User with email: ${email} is already active`,
        );
      }

      await this.userRepository.restore(user.id);

      // 4. Reuse login flow
      return await this.authService.login(loginDto);
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
}
