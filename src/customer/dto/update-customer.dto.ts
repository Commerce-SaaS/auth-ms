import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCustomerDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsUUID()
  organizationId: string;
}
