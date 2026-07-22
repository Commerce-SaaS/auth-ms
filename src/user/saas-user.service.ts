import { Injectable, Logger } from '@nestjs/common';
import { UpdateSaaSUserDto } from './dto/update-user.dto';
import { SaasUser } from './entities/saas-user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import * as bcrypt from 'bcrypt';
import { SaaSAuthService } from 'src/auth/saas-auth/saas-auth.service';
import { SessionService } from 'src/session/session.service';
import { LoginDto } from 'src/auth/saas-auth/dto/saas-login.dto';

@Injectable()
export class SaaSUserService {
  private readonly logger = new Logger(SaaSUserService.name);

  constructor(
    @InjectRepository(SaasUser) private readonly repo: Repository<SaasUser>,
    private readonly saaSAuthService: SaaSAuthService,
    private readonly sessionService: SessionService,
  ) {}

  async getProfile(id: string) {
    try {
      this.logger.log(`Fetching user id=${id}"`);

      const user = await this.repo.findOne({
        where: { id },
      });

      if (!user) {
        this.logger.warn(`User with id=${id} not found in the database.`);
        RpcExceptionHelper.notFound('User');
      }

      const { passwordHash, deletedAt, updatedAt, ...safeUser } = user;
      this.logger.log(`Fetched user id=${id}`);
      return safeUser;
    } catch (error: any) {
      this.logger.error(`Error fetching user id=${id}: ${error.message}`);
      RpcExceptionHelper.handle(error);
    }
  }

  async update(dto: UpdateSaaSUserDto) {
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
    } catch (error: any) {
      this.logger.error(
        `Error updating user with id=${dto.id}: ${error.message}`,
      );
      RpcExceptionHelper.handle(error);
    }
  }

  async softDelete(id: string) {
    try {
      const user = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });
      if (!user) {
        RpcExceptionHelper.badRequestException(`User with id: ${id} not found`);
      }

      if (!user.deletedAt) {
        await this.repo.softDelete(id);
      }

      await this.sessionService.logoutAllSessions(id);

      return { message: `User with id: ${id} was soft deleted` };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
  async restoreUser(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      const user = await this.repo.findOne({
        where: { email: email.toLowerCase() },
        withDeleted: true,
      });

      if (!user) {
        RpcExceptionHelper.notFound('User');
      }

      const isPasswordValid =
        !!user.passwordHash &&
        (await bcrypt.compare(password, user.passwordHash));
      if (!user || !isPasswordValid) {
        RpcExceptionHelper.unauthorized('Invalid credentials');
      }

      if (!user.deletedAt) {
        RpcExceptionHelper.badRequestException(
          `User with email: ${email} is already active`,
        );
      }

      await this.repo.restore(user.id);

      return await this.saaSAuthService.login(loginDto);
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
}
