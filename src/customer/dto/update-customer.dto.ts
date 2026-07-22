import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCustomerDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
