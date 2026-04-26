import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { RpcException } from '@nestjs/microservices';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class VehiclesService extends PrismaClient implements OnModuleInit {
  private logger = new Logger('Vehicles Service')

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    super({
      adapter: new PrismaPg({ connectionString: url }),
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

  async findOne(id: number) {
    const vehicle = await this.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      throw new RpcException(`Vehicle with id ${id} not found`);
    }

    return vehicle;
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

    return this.vehicle.delete({
      where: { id },
    });
  }
}
