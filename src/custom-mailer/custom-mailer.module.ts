import { Module } from '@nestjs/common';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { CustomMailerService } from './custom-mailer.service';
import { envs } from 'src/config';
import { join } from 'path';


const templatesDir =
  process.env.NODE_ENV === 'production'
    ? join(__dirname, 'templates')
    : join(__dirname, '../../src/custom-mailer/templates');

@Module({
  providers: [CustomMailerService],
  imports: [
    NestMailerModule.forRoot({
      transport: {
        host: envs.smtpHost,
        port: envs.smtpPort,
        secure: true,
        auth: {
          user: envs.smtpUser,
          pass: envs.smtpPass,
        },
      },
      defaults: {
        from: envs.smtpFrom,
      },
      template: {
        dir: templatesDir,
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    })
  ],
  exports: [CustomMailerService, NestMailerModule],
})
export class CustomMailerModule {}
