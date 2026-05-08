import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { CreateVehicleDto, UpdateVehicleDto } from '@rideglory/contracts';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PrismaPg } from '@prisma/adapter-pg';
import { firstValueFrom, timeout } from 'rxjs';
import { USERS_SERVICE } from '../config';

@Injectable()
export class VehiclesService extends PrismaClient implements OnModuleInit {
  private logger = new Logger('Vehicles Service')

  constructor(
    @Inject(USERS_SERVICE) private readonly usersService: ClientProxy,
  ) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    super({
      adapter: new PrismaPg({ connectionString: url }),
    });

    this.logger.log('Database connected');
  }

  private async validateOwnerExists(ownerId: string) {
    try {
      await firstValueFrom(
        this.usersService.send('findOneUser', { id: ownerId }).pipe(timeout(3000)),
      );
    } catch {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: `Owner user with id ${ownerId} does not exist`,
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async create(createVehicleDto: CreateVehicleDto) {
    await this.validateOwnerExists(createVehicleDto.ownerId);

    return this.vehicle.create({
      data: createVehicleDto
    });
  }

  findAll() {
    return this.vehicle.findMany();
  }

  findByOwnerId(ownerId: string) {
    return this.vehicle.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      throw new RpcException(`Vehicle with id ${id} not found`);
    }

    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto) {
    if (updateVehicleDto.ownerId) {
      await this.validateOwnerExists(updateVehicleDto.ownerId);
    }

    await this.findOne(id);

    return this.vehicle.update({
      where: { id },
      data: updateVehicleDto
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.vehicle.delete({
      where: { id },
    });
  }
}
