import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsUUID()
  organizationId: string;

  @IsNotEmpty()
  @IsString()
  name: string;
}
