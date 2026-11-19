import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AppConfiguration,
  AppEnvironment,
  EmailConfiguration,
} from '@infrastructure/config/config.interface';

const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send';

/**
 * Sends email through SendGrid's v3 REST API (plain fetch, no SDK). Without a
 * SENDGRID_API_KEY the app still boots and emails are logged instead of sent,
 * so local and dev run without SendGrid credentials.
 */
@Injectable()
export class AppEmailService {
  private readonly logger = new Logger(AppEmailService.name);
  private readonly apiKey: string | null;
  private readonly defaultFrom: string | undefined;
  private readonly logContent: boolean;

  constructor(configService: ConfigService) {
    const email = configService.get<EmailConfiguration>('email');
    this.logContent =
      configService.get<AppConfiguration>('app')?.env === AppEnvironment.Local;
    this.defaultFrom = email?.defaultFrom;
    this.apiKey = email?.sendgridApiKey || null;
    if (!this.apiKey) {
      this.logger.warn(
        'SENDGRID_API_KEY not set — emails will be logged, not sent.',
      );
    }
  }

  async send(subject: string, to: string, html: string): Promise<void> {
    if (!this.apiKey) {
      // Emails carry addresses and reset codes, so only a local machine logs
      // them in full.
      if (this.logContent) {
        this.logger.log(`[email] to=${to} subject="${subject}" html=${html}`);
      } else {
        this.logger.log(`[email not sent] subject="${subject}"`);
      }
      return;
    }
    const response = await fetch(SENDGRID_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: this.defaultFrom },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!response.ok) {
      throw new Error(`SendGrid answered ${response.status}`);
    }
  }
}
