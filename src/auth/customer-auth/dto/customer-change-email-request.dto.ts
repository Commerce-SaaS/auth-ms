import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ChangeEmailRequestDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEmail()
  newEmail: string;
}