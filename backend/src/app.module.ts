import { Module } from '@nestjs/common';
import { ConsignadoController } from './consignado/consignado.controller';

@Module({
  imports: [],
  controllers: [ConsignadoController],
  providers: [],
})
export class AppModule {}
