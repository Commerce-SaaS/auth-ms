import { Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const { name, ownerId } = createOrganizationDto;
    try {
      // 1# Check if organization already exists
      const exists = await this.organizationRepository.findOne({
        where: { name, ownerId },
      });

      // 2# If exists, throw an error
      if (exists) {
        RpcExceptionHelper.duplicate('Organization');
      }

      // 3# If not, create a new organization
      const newOrganization = await this.organizationRepository.save(
        createOrganizationDto,
      );

      return newOrganization;
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  // findAllByOwner() {
  //   return `This action returns all organization`;
  // }

  async findOne(id: string) {
    try {
      const organization = await this.organizationRepository.findOneBy({ id });

      if (!organization) {
        RpcExceptionHelper.notFound('Organization');
      }

      return organization;
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const {ownerId, ...rest} = updateOrganizationDto;
    try {
      // 1# Verify if organization exists
      const organizationUpdated = await this.organizationRepository.preload({
        ...rest,
        id: id,
      });
      if (!organizationUpdated) {
        RpcExceptionHelper.badRequestExcetion(
          `Organization with id: ${id} not found`,
        );
      }
      // 2# Save to DB
      this.organizationRepository.save(organizationUpdated);

      // 3# Return updated organization
      return organizationUpdated;
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }

  async softDelete(id: string) {
    try {
      // 1# Verify if organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id },
        withDeleted: true,
      });
      if (!organization) {
        RpcExceptionHelper.badRequestExcetion(
          `Organization with id: ${id} not found`,
        );
      }

      if (organization.deletedAt) {
        RpcExceptionHelper.badRequestExcetion(
          `Organization with id: ${id} already soft deleted`,
        );
      }

      // 2# Soft delete
      await this.organizationRepository.softDelete(id);
      return { message: `Organization with id: ${id} soft deleted` };
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
}
