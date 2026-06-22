import {
  IsEmail,
  IsJWT,
  IsNotEmpty,
  IsNumberString,
  IsString,
  IsStrongPassword,
  IsUUID,
  Length,
} from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @IsNumberString()
  code: string;

  @IsNotEmpty()
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must be at least 8 characters long and include uppercase, lowercase, number and symbol',
    },
  )
  password: string;

  @IsUUID()
  organizationId: string;
}
