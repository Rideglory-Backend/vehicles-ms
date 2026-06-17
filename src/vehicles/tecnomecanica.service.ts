import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { RpcException } from '@nestjs/microservices';
import { CreateTecnomecanicaDto } from './dto/create-tecnomecanica.dto';

@Injectable()
export class TecnomecanicaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('TecnomecanicaService');

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    super({
      adapter: new PrismaPg({ connectionString: url }),
    });
    this.logger.log('TecnomecanicaService DB connected');
  }

  async onModuleInit() {
    await this.$connect();
  }

  async upsertTecnomecanica(
    vehicleId: string,
    ownerId: string,
    dto: CreateTecnomecanicaDto,
  ) {
    await this.validateVehicleOwnership(vehicleId, ownerId);

    const expiryDate = this.parseDate(dto.expiryDate, 'expiryDate');
    const startDate = this.parseDate(dto.startDate, 'startDate');

    if (expiryDate <= startDate) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'expiryDate must be after startDate',
      });
    }

    return this.tecnomecanica.upsert({
      where: { vehicleId },
      create: {
        vehicleId,
        cdaName: dto.cdaName,
        startDate,
        expiryDate,
        documentUrl: dto.documentUrl ?? null,
      },
      update: {
        cdaName: dto.cdaName,
        startDate,
        expiryDate,
        documentUrl: dto.documentUrl ?? null,
      },
    });
  }

  async findTecnomecanicaByVehicle(vehicleId: string, ownerId: string) {
    await this.validateVehicleOwnership(vehicleId, ownerId);
    return this.tecnomecanica.findUnique({ where: { vehicleId } });
  }

  async deleteTecnomecanica(vehicleId: string, ownerId: string) {
    await this.validateVehicleOwnership(vehicleId, ownerId);

    const existing = await this.tecnomecanica.findUnique({
      where: { vehicleId },
    });
    if (!existing) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `No RTM found for vehicle ${vehicleId}`,
      });
    }

    await this.tecnomecanica.delete({ where: { vehicleId } });
    return { success: true };
  }

  /**
   * Returns all RTM records that expire in exactly `daysUntilExpiry` days
   * (whole-day granularity, in UTC).
   */
  async findTecnomecanicasExpiringIn(daysUntilExpiry: number) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + daysUntilExpiry);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.tecnomecanica.findMany({
      where: {
        expiryDate: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  private async validateVehicleOwnership(
    vehicleId: string,
    ownerId: string,
  ): Promise<void> {
    const vehicle = await this.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Vehicle ${vehicleId} not found`,
      });
    }

    if (vehicle.ownerId !== ownerId) {
      throw new RpcException({
        status: HttpStatus.FORBIDDEN,
        message: 'Vehicle does not belong to this owner',
      });
    }
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: `Invalid ISO-8601 date for field ${field}`,
      });
    }
    return date;
  }
}
