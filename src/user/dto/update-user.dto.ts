import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateSaaSUserDto {
  @IsUUID('4')
  id: string;

  @IsNotEmpty()
  @IsString()
  name: string;
}
