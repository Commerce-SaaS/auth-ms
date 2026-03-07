import { IsEmail, IsEnum, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsString()
  email: string;
}
