import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { RpcException } from '@nestjs/microservices';
import { CreateSoatDto } from './dto/create-soat.dto';

@Injectable()
export class SoatService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('SoatService');

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    super({
      adapter: new PrismaPg({ connectionString: url }),
    });
    this.logger.log('SoatService DB connected');
  }

  async onModuleInit() {
    await this.$connect();
  }

  async upsertSoat(vehicleId: string, ownerId: string, dto: CreateSoatDto) {
    await this.validateVehicleOwnership(vehicleId, ownerId);

    const startDate = this.parseDate(dto.startDate, 'startDate');
    const expiryDate = this.parseDate(dto.expiryDate, 'expiryDate');

    if (expiryDate <= startDate) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'expiryDate must be after startDate',
      });
    }

    return this.soat.upsert({
      where: { vehicleId },
      create: {
        vehicleId,
        policyNumber: dto.policyNumber ?? '',
        startDate,
        expiryDate,
        insurer: dto.insurer,
        documentUrl: dto.documentUrl ?? null,
      },
      update: {
        policyNumber: dto.policyNumber ?? '',
        startDate,
        expiryDate,
        insurer: dto.insurer,
        documentUrl: dto.documentUrl ?? null,
      },
    });
  }

  async findSoatByVehicle(vehicleId: string, ownerId: string) {
    await this.validateVehicleOwnership(vehicleId, ownerId);
    return this.soat.findUnique({ where: { vehicleId } });
  }

  /**
   * Returns all SOAT records that expire in exactly `daysUntilExpiry` days
   * (whole-day granularity, in UTC).
   */
  async findSoatsExpiringIn(daysUntilExpiry: number) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() + daysUntilExpiry);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.soat.findMany({
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
