import {
  IsEmail,
  IsString,
  Length,
  IsNumberString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @IsNumberString()
  code: string;

  @IsUUID()
  organizationId: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsString()
  logoUrl: string;

  @IsNotEmpty()
  @IsString()
  orgName: string;
}
