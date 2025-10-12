import { Controller } from '@nestjs/common';
import { SessionService } from './session.service';
import { SESSION_PATTERNS } from './patterns/session_patterns';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @MessagePattern(SESSION_PATTERNS.LOGOUT)
  logout(@Payload() token: string) {
    return this.sessionService.logoutSession(token);
  }

  @MessagePattern(SESSION_PATTERNS.LOGOUT_ALL)
  logoutAllSessions(@Payload() userId: { id: string }) {
    return this.sessionService.logoutAllSessions(userId.id);
  }
}
