import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ForgotPasswordDto {
  @IsUUID()
  organizationId: string;
  
  @IsEmail()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  logoUrl: string;

  @IsNotEmpty()
  @IsString()
  orgName: string;
}
