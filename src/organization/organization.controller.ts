import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ORGANIZATION_PATTERNS } from './patterns/organization_patterns';

@Controller()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @MessagePattern(ORGANIZATION_PATTERNS.CREATE_ORGANIZATION)
  create(@Payload() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationService.create(createOrganizationDto);
  }

  // @MessagePattern(ORGANIZATION_PATTERNS.FIND_ALL_ORGANIZATIONS_BY_OWNER)
  // findAll() {
  //   return this.organizationService.findAllByOwner();
  // }

  @MessagePattern(ORGANIZATION_PATTERNS.GET_ORGANIZATION)
  findOne(@Payload() id: string) {
    return this.organizationService.findOne(id);
  }

  @MessagePattern(ORGANIZATION_PATTERNS.UPDATE_ORGANIZATION)
  update(@Payload() updateOrganizationDto: UpdateOrganizationDto) {
    return this.organizationService.update(
      updateOrganizationDto.id,
      updateOrganizationDto,
    );
  }

  @MessagePattern(ORGANIZATION_PATTERNS.DELETE_ORGANIZATION)
  softDelete(@Payload() id: string) {
    return this.organizationService.softDelete(id);
  }
}
