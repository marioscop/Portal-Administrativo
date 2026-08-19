import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConsignadoController } from './consignado/consignado.controller.js';
import { ConsignadoService } from './consignado/consignado.service.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 600,
      },
    ]),
  ],
  controllers: [ConsignadoController],
  providers: [
    ConsignadoService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
