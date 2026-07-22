import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';
import { envs } from 'src/config';

@Injectable()
export class GoogleOAuthService {
  private client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(envs.googleClientId);
  }

  async verifyIdToken(idToken: string) {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: envs.googleClientId,
      });

      return ticket.getPayload();
    } catch (error) {
      RpcExceptionHelper.handle(error);
    }
  }
}
