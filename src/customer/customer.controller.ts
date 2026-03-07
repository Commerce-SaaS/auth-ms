import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CUSTOMER_USER_PATTERNS } from './patterns/customer_patterns';
import { LoginDto } from 'src/auth/shared/dto/login.dto';
import { CustomerService } from './customer.service';

@Controller()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @MessagePattern(CUSTOMER_USER_PATTERNS.GET_PROFILE)
  getProfile(@Payload() userId: string) {
    return this.customerService.getProfile(userId);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.UPDATE)
  update(@Payload() dto: UpdateCustomerDto) {
    return this.customerService.update(dto);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.DELETE)
  softDelete(@Payload() id: string) {
    return this.customerService.softDelete(id);
  }

  @MessagePattern(CUSTOMER_USER_PATTERNS.RESTORE)
  restoreUser(@Payload() loginDto: LoginDto) {
    return this.customerService.restoreUser(loginDto);
  }
}
