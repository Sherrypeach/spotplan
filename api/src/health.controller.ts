import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

import { AppConfiguration } from '@infrastructure/config/config.interface';

/** Unauthenticated liveness probe — the platform's fleet monitor curls this. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  health() {
    const app = this.configService.get<AppConfiguration>('app');
    return { ok: true, name: app?.name, version: app?.version };
  }
}
