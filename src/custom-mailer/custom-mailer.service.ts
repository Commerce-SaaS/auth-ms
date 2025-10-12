import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { RpcExceptionHelper } from 'src/common/helpers/rpc-exception.helper';

@Injectable()
export class CustomMailerService {
  constructor(private readonly mailerService: MailerService) {}
  private async sendTemplateEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context,
      });
    } catch (error) {
      console.error(`Error sending ${template} email:`, error);
      RpcExceptionHelper.internalServerError(`Error sending ${template} email`);
    }
  }

  async sendForgotPasswordEmail(to: string, resetLink: string) {
    return this.sendTemplateEmail(
      to,
      'Reset your password',
      './forgot-password',
      { resetLink, year: new Date().getFullYear() },
    );
  }

  async sendVerifyEmail(to: string, verifyLink: string) {
    return this.sendTemplateEmail(to, 'Verify your account', './verify-email', {
      verifyLink,
      year: new Date().getFullYear(),
    });
  }
}
