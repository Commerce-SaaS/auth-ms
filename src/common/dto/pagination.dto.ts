import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  limit?: number;
}

export class PaginationCustomerDto {
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  limit?: number;

  @IsUUID()
  organizationId: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  withDeleted?: boolean;

  @IsString()
  @IsOptional()
  search?: string;
}
