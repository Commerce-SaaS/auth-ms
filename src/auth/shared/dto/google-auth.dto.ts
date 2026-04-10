import { IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  idToken: string;

  @IsString()
  organizationId: string;
}
