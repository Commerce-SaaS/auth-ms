import { IsString, IsUUID } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  idToken: string;

  @IsUUID()
  organizationId: string;
}
