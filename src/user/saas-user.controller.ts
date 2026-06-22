import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SaaSUserService } from './saas-user.service';
import { UpdateSaaSUserDto } from './dto/update-user.dto';
import { SAAS_USER_PATTERNS } from './patterns/saas_user_patterns';
import { LoginDto } from 'src/auth/saas-auth/dto/saas-login.dto';

@Controller()
export class SaaSUserController {
  constructor(private readonly saaSUserService: SaaSUserService) {}

  @MessagePattern(SAAS_USER_PATTERNS.GET_PROFILE)
  getProfile(@Payload() userId: string) {
    return this.saaSUserService.getProfile(userId);
  }

  @MessagePattern(SAAS_USER_PATTERNS.UPDATE)
  update(@Payload() dto: UpdateSaaSUserDto) {
    return this.saaSUserService.update(dto);
  }

  @MessagePattern(SAAS_USER_PATTERNS.DEACTIVATE)
  softDelete(@Payload() id: string) {
    return this.saaSUserService.softDelete(id);
  }

  @MessagePattern(SAAS_USER_PATTERNS.RESTORE)
  restoreUser(@Payload() loginDto: LoginDto) {
    return this.saaSUserService.restoreUser(loginDto);
  }
}
