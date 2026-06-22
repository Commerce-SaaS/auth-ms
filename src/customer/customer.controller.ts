import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CUSTOMER_USER_PATTERNS } from './patterns/customer_patterns';
import { CustomerService } from './customer.service';
import { PaginationCustomerDto } from 'src/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { RestoreCustomerDto } from './dto/restore-customer.dto';
import { UpdateCustomerByAdminDto } from './dto/update-customer-by-admin.dto copy';

@Controller()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @MessagePattern(CUSTOMER_USER_PATTERNS.CREATE)
  create(@Payload() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.GET_ALL_PROFILES)
  getAllProfiles(@Payload() paginationCustomerDto: PaginationCustomerDto) {
    return this.customerService.getAllProfiles(paginationCustomerDto);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.GET_PROFILE)
  getProfile(@Payload() userId: string) {
    return this.customerService.getProfile(userId);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.UPDATE)
  update(@Payload() dto: UpdateCustomerDto) {
    return this.customerService.update(dto);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.DELETE)
  delete(@Payload() id: string) {
    return this.customerService.delete(id);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.SOFT_DELETE)
  softDelete(@Payload() id: string) {
    return this.customerService.softDelete(id);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.RESTORE)
  restore(@Payload() dto: RestoreCustomerDto) {
    return this.customerService.restoreCustomer(dto);
  }

  // ADMIN

  @MessagePattern(CUSTOMER_USER_PATTERNS.GET_PROFILE_BY_ADMIN)
  getProfileByAdmin(@Payload() p: { id: string; organizationId: string }) {
    return this.customerService.getProfileByAdmin(p.id, p.organizationId);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.UPDATE_BY_ADMIN)
  updateByAdmin(@Payload() dto: UpdateCustomerByAdminDto) {
    return this.customerService.updateByAdmin(dto);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.SOFT_DELETE_BY_ADMIN)
  softDeleteByAdmin(@Payload() p: { id: string; organizationId: string }) {
    return this.customerService.softDeleteByAdmin(p.id, p.organizationId);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.DELETE_BY_ADMIN)
  deleteByAdmin(@Payload() p: { id: string; organizationId: string }) {
    return this.customerService.deleteByAdmin(p.id, p.organizationId);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.RESTORE_BY_ADMIN)
  restoreCustomerByAdmin(@Payload() p: { id: string; organizationId: string }) {
    return this.customerService.restoreCustomerByAdmin(p.id, p.organizationId);
  }
}
