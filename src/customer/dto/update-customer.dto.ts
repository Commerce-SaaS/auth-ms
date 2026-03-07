import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCustomerDto {
  @IsUUID('4')
  id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @Transform(({ value }) => (value ? new Date(value) : null))
  @IsDate()
  @IsOptional()
  deletedAt?: Date | null;
}
