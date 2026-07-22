import { Controller } from '@nestjs/common';
import { SessionService } from './session.service';
import { SESSION_PATTERNS } from './patterns/session_patterns';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @MessagePattern(SESSION_PATTERNS.LOGOUT)
  logout(@Payload() payload: { jti: string; userId: string }) {
    return this.sessionService.logoutSession(payload.jti, payload.userId);
  }

  @MessagePattern(SESSION_PATTERNS.LOGOUT_ALL)
  logoutAllSessions(@Payload() userId: string) {
    return this.sessionService.logoutAllSessions(userId);
  }

  @MessagePattern(SESSION_PATTERNS.LIST)
  listSessions(@Payload() p: { userId: string; currentJti?: string }) {
    return this.sessionService.listSessions(p.userId, p.currentJti);
  }

  @MessagePattern(SESSION_PATTERNS.REVOKE)
  revokeSession(@Payload() p: { userId: string; jti: string }) {
    return this.sessionService.revokeSession(p.userId, p.jti);
  }
}
