import { Global, Module } from '@nestjs/common';

import { AppEmailService } from '@infrastructure/email/email.service';

/** Global so any module can send email without re-importing. */
@Global()
@Module({
  providers: [AppEmailService],
  exports: [AppEmailService],
})
export class EmailModule {}
