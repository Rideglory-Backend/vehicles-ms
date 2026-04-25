import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService extends PrismaClient implements OnModuleInit {
  private logger = new Logger('Vehicles Service')

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    super({
      adapter: new PrismaBetterSqlite3({ url }),
    });

    this.logger.log('Database connected');
  }

  async onModuleInit() {
    await this.$connect();
  }

  create(createVehicleDto: CreateVehicleDto) {
    return this.vehicle.create({
      data: createVehicleDto
    });
  }

  findAll() {
    return this.vehicle.findMany();
  }

  findOne(id: number) {
    return this.vehicle.findUnique({
      where: { id }
    });
  }

  async update(id: number, updateVehicleDto: UpdateVehicleDto) {
    const { id: ___, ...data } = updateVehicleDto;

    await this.findOne(id);

    return this.vehicle.update({
      where: { id },
      data: data
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.vehicle.update({
      where: { id },
      data: {
        isArchived: true
      }
    });
  }
}
