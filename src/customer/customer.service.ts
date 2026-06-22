import { Inject, Injectable, Logger } from '@nestjs/common';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import * as bcrypt from 'bcrypt';
import { CustomerAuthService } from 'src/auth/customer-auth/customer-auth.service';
import { Customer } from './entities/customer.entity';
import { PaginationCustomerDto } from 'src/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { AUTHZ_PATTERNS } from 'src/auth/saas-auth/patterns/saas-auth.patterns';
import { UserAuthzRefreshReason } from 'src/auth/saas-auth/enums/user_authz_refresh_reason.enum';
import { AUTHZ_EVENTS_CLIENT } from 'src/config/services';
import { ClientProxy } from '@nestjs/microservices';
import { SessionService } from 'src/session/session.service';
import { RestoreCustomerDto } from './dto/restore-customer.dto';
import { UpdateCustomerByAdminDto } from './dto/update-customer-by-admin.dto copy';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    private readonly customerAuthService: CustomerAuthService,
    private readonly sessionService: SessionService,
    @Inject(AUTHZ_EVENTS_CLIENT)
    private readonly authzClient: ClientProxy,
  ) {}

  async create(dto: CreateCustomerDto) {
    const { email, organizationId } = dto;

    const customer = await this.repo.findOne({
      where: { email, organizationId },
      withDeleted: true,
    });

    if (customer) {
      RpcExceptionHelper.duplicate('Customer');
    }
    try {
      const newUser = await this.repo.save({ emailVerified: true, ...dto });

      const { passwordHash: _, deletedAt, updatedAt, ...rest } = newUser;

      // Emit authz event
      this.authzClient.emit(AUTHZ_PATTERNS.USER_AUTHZ_REFRESH, {
        userId: newUser.id,
        organizationId,
        reason: UserAuthzRefreshReason.REGISTER_CUSTOMER,
      });

      return {
        customer: rest,
      };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async getAllProfiles(pagination: PaginationCustomerDto) {
    const {
      organizationId,
      limit = 10,
      offset = 0,
      search,
      withDeleted = false,
    } = pagination;

    try {
      if (!organizationId) {
        RpcExceptionHelper.badRequestException('organizationId is required');
      }

      this.logger.log(`Fetching customers [organizationId=${organizationId}]`);

      const query = this.repo
        .createQueryBuilder('customer')
        .where('customer.organizationId = :organizationId', { organizationId })
        .andWhere('customer.isPermanentlyDeleted = :isPermanentlyDeleted', {
          isPermanentlyDeleted: false,
        });

      if (search) {
        query.andWhere(
          '(customer.name ILIKE :search OR customer.email ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      if (withDeleted) query.withDeleted();

      query.skip(offset).take(limit).orderBy('customer.createdAt', 'DESC');

      const [items, totalItems] = await query.getManyAndCount();

      this.logger.log(
        `Customers fetched successfully [organizationId=${organizationId}]`,
      );

      return {
        customers: items.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          emailVerified: customer.emailVerified,
          createdAt: customer.createdAt,
          deletedAt: customer.deletedAt,
        })),
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: Math.floor(offset / limit) + 1,
        hasMore: offset + limit < totalItems,
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching customers [organizationId=${organizationId}]: ${error.message}`,
      );
      RpcExceptionHelper.handle(error);
    }
  }

  async getProfile(id: string) {
    try {
      this.logger.log(`Fetching customer id=${id}"`);

      const customer = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });

      if (!customer) {
        this.logger.warn(`Customer with id=${id} not found in the database.`);
        RpcExceptionHelper.notFound('customer');
      }

      this.logger.log(`Fetched customer id=${id}`);
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        createdAt: customer.createdAt,
        deletedAt: customer.deletedAt,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching customer id=${id}: ${error.message}`);
      RpcExceptionHelper.handle(error);
    }
  }

  async update(dto: UpdateCustomerDto) {
    const { id, organizationId, ...rest } = dto;
    try {
      this.logger.log(`Updating customer with id=${id}`);

      const customerUpdated = await this.repo.update(
        { id, organizationId },
        rest,
      );

      if (!customerUpdated.affected) {
        this.logger.warn(
          `Failed to update customer with id=${id} (not found in org)`,
        );
        RpcExceptionHelper.notFound(`Customer with id: ${id} not found`);
      }

      this.logger.log(`Customer with id=${id} updated successfully`);
      return this.getProfile(id);
    } catch (error: any) {
      this.logger.error(
        `Error updating customer with id=${id}: ${error.message}`,
      );
      RpcExceptionHelper.handle(error);
    }
  }

  async delete(id: string) {
    try {
      const customer = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });
      if (!customer) {
        RpcExceptionHelper.notFound('Customer');
      }

      await this.repo.update(id, {
        email: `deleted_${id}@deleted.invalid`,
        name: `Deleted customer ${id}`,
        passwordHash: 'DELETED',
        googleId: null,
        provider: null,
        isPermanentlyDeleted: true,
        deletedAt: new Date(),
      });

      await this.sessionService.logoutAllSessions(id);

      return { message: `Customer with id: ${id} was deleted` };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async softDelete(id: string) {
    try {
      const customer = await this.repo.findOne({
        where: { id },
        withDeleted: true,
      });
      if (!customer) {
        RpcExceptionHelper.notFound('Customer');
      }

      if (!customer.deletedAt) {
        await this.repo.softDelete(id);
      }
      await this.sessionService.logoutAllSessions(id);

      return { message: `Customer with id: ${id} was soft deleted` };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async restoreCustomer(dto: RestoreCustomerDto) {
    const { email, password, organizationId } = dto;

    try {
      const customer = await this.repo.findOne({
        where: { email: email.toLowerCase(), organizationId },
        withDeleted: true,
      });

      const isPasswordValid =
        !!customer?.passwordHash &&
        (await bcrypt.compare(password, customer.passwordHash));

      if (!customer || !isPasswordValid) {
        RpcExceptionHelper.unauthorized('Invalid credentials');
      }

      if (!customer.deletedAt) {
        RpcExceptionHelper.badRequestException(
          `Customer with email: ${email} is already active`,
        );
      }

      await this.repo.restore(customer.id);

      return await this.customerAuthService.login(dto);
    } catch (error: any) {
      RpcExceptionHelper.handle(error);
    }
  }

  // ADMIN

  async getProfileByAdmin(id: string, organizationId: string) {
    const customer = await this.repo.findOne({
      where: { id, organizationId },
      withDeleted: true,
    });
    if (!customer) RpcExceptionHelper.notFound('Customer');
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      emailVerified: customer.emailVerified,
      createdAt: customer.createdAt,
      deletedAt: customer.deletedAt,
    };
  }

  async updateByAdmin(dto: UpdateCustomerByAdminDto) {
    const { id, organizationId, email, ...rest } = dto;
    try {
      const customer = await this.repo.findOne({
        where: { id, organizationId },
      });
      if (!customer) {
        RpcExceptionHelper.notFound(`Customer with id: ${id} not found`);
      }

      const updateData: Partial<Customer> = { ...rest }; // name/phone siempre permitidos

      // ¿pidió cambiar el email?
      if (email && email.toLowerCase() !== customer.email) {
        if (customer.emailVerified) {
          RpcExceptionHelper.badRequestException(
            'This customer already verified their email; they must change it from their own account',
          );
        }
        updateData.email = email.toLowerCase();
        updateData.emailVerified = false;
      }

      await this.repo.update({ id, organizationId }, updateData);
      return this.getProfile(id);
    } catch (error: any) {
      RpcExceptionHelper.handle(error);
    }
  }

  async softDeleteByAdmin(id: string, organizationId: string) {
    const customer = await this.repo.findOne({
      where: { id, organizationId },
      withDeleted: true,
    });
    if (!customer) RpcExceptionHelper.notFound('Customer');

    if (!customer.deletedAt) {
      await this.repo.softDelete({ id, organizationId });
    }
    await this.sessionService.logoutAllSessions(id);
    return { message: `Customer with id: ${id} was soft deleted` };
  }

  async deleteByAdmin(id: string, organizationId: string) {
    const customer = await this.repo.findOne({
      where: { id, organizationId },
      withDeleted: true,
    });
    if (!customer) RpcExceptionHelper.notFound('Customer');

    await this.repo.update(
      { id, organizationId },
      {
        email: `deleted_${id}@deleted.invalid`,
        name: `Deleted customer ${id}`,
        passwordHash: 'DELETED',
        googleId: null,
        provider: null,
        isPermanentlyDeleted: true,
        deletedAt: new Date(),
      },
    );

    await this.sessionService.logoutAllSessions(id);
    return { message: `Customer with id: ${id} was deleted` };
  }

  async restoreCustomerByAdmin(id: string, organizationId: string) {
    const user = await this.repo.findOne({
      where: { id, organizationId },
      withDeleted: true,
    });
    if (!user) RpcExceptionHelper.notFound('Customer');
    if (!user.deletedAt) {
      RpcExceptionHelper.badRequestException(
        `Customer with id: ${id} is already active`,
      );
    }

    await this.repo.restore({ id, organizationId });

    return {
      message: `Customer with id: ${id} has been restored successfully`,
    };
  }
}
