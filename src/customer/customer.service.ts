import { Injectable, Logger } from '@nestjs/common';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import * as bcrypt from 'bcrypt';
import { LoginDto } from 'src/auth/shared/dto/login.dto';
import { CustomerAuthService } from 'src/auth/customer-auth/customer-auth.service';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    private readonly customerAuthService: CustomerAuthService,
  ) {}

  async getProfile(id: string) {
    try {
      this.logger.log(`Fetching user id=${id}"`);

      const user = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        this.logger.warn(`User with id=${id} not found in the database.`);
        RpcExceptionHelper.notFound('User');
      }

      const { passwordHash, ...safeUser } = user;
      this.logger.log(`Fetched user id=${id}`);
      return safeUser;
    } catch (error) {
      this.logger.error(`Error fetching user id=${id}: ${error.message}`);
      RpcExceptionHelper.handle(error);
    }
  }

  async update(dto: UpdateCustomerDto) {
    const { id, ...rest } = dto;
    try {
      this.logger.log(`Updating user with id=${dto.id}`);

      const userUpdated = await this.repo.update({ id }, { ...rest });

      if (!userUpdated.affected) {
        this.logger.warn(`Failed to update user with id=${id} (not found)`);
        RpcExceptionHelper.notFound(`User with id: ${id} not found`);
      }

      this.logger.log(`User with id=${id} updated successfully`);
      return this.getProfile(id);
    } catch (error) {
      this.logger.error(
        `Error updating user with id=${dto.id}: ${error.message}`,
      );
      RpcExceptionHelper.handle(error);
    }
  }

  async softDelete(id: string) {
    try {
      // 1# Verify if user exists
      const user = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!user) {
        RpcExceptionHelper.badRequestException(`User with id: ${id} not found`);
      }

      if (user.deletedAt) {
        RpcExceptionHelper.badRequestException(
          `User with id: ${id} already soft deleted`,
        );
      }

      // 2# Apply soft delete updates
      await this.repo.softDelete(id);

      return { message: `User with id: ${id} was soft deleted` };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async restoreUser(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      // 1. Find user including soft-deleted
      const user = await this.repo.findOne({
        where: { email: email.toLowerCase() },
        withDeleted: true,
      });

      if (!user) {
        RpcExceptionHelper.notFound('User');
      }

      // 2. Validate password BEFORE restoring
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        RpcExceptionHelper.unauthorized('Invalid credentials');
      }

      // 3. Only restore if deleted
      if (!user.deletedAt) {
        RpcExceptionHelper.badRequestException(
          `User with email: ${email} is already active`,
        );
      }

      await this.repo.restore(user.id);

      // 4. Reuse login flow
      return await this.customerAuthService.login(loginDto);
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
}
