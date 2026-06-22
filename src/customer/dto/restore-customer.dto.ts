import { IsEmail, IsString, IsStrongPassword, IsUUID } from 'class-validator';

export class RestoreCustomerDto {
  @IsString()
  @IsEmail()
  email: string;

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
