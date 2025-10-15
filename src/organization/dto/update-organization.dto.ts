import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';
import { IsUUID } from 'class-validator';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsUUID()
  id: string;
}
