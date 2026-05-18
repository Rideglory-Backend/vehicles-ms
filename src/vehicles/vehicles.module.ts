import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs, USERS_SERVICE } from '../config';
import { VehiclesService } from './vehicles.service';
import { SoatService } from './soat.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: USERS_SERVICE,
        transport: Transport.TCP,
        options: {
          host: envs.usersMsHost,
          port: envs.usersMsPort,
        },
      },
    ]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService, SoatService],
})
export class VehiclesModule {}
