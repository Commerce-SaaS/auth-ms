import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { USER_PATTERNS } from './patterns/user_patterns';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern(USER_PATTERNS.GET_PROFILE)
  getProfile(@Payload() user: { id: string }) {
    return this.userService.getProfile(user.id);
  }

  @MessagePattern(USER_PATTERNS.UPDATE_USER)
  update(@Payload() updateUserDto: UpdateUserDto) {
    return this.userService.update(updateUserDto);
  }

  @MessagePattern(USER_PATTERNS.DELETE_USER)
  softDelete(@Payload() id: string) {
    return this.userService.softDelete(id);
  }

  @MessagePattern(USER_PATTERNS.RESTORE_USER)
  restoreUser(@Payload() loginDto: LoginDto) {
    return this.userService.restoreUser(loginDto);
  }
}
