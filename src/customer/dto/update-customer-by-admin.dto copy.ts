import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCustomerByAdminDto {
  @IsUUID()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
