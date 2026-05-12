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

  /**
   * Clients may send date-only-time local strings without offset (e.g. from Dart
   * `toIso8601String()`). Prisma expects full ISO-8601 with zone.
   */
  private normalizePurchaseDate(value: string | undefined | null): Date | undefined {
    if (value == null || value === '') {
      return undefined;
    }
    const trimmed = String(value).trim();
    const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed);
    const looksLikeLocalNaive =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/.test(trimmed);
    const iso = !hasZone && looksLikeLocalNaive ? `${trimmed}Z` : trimmed;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid purchaseDate; expected ISO-8601 date-time',
      });
    }
    return d;
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

    const existingCount = await this.vehicle.count({
      where: { ownerId: createVehicleDto.ownerId },
    });

    const { purchaseDate, ...rest } = createVehicleDto;

    return this.vehicle.create({
      data: {
        ...rest,
        ...(purchaseDate != null && purchaseDate !== ''
          ? { purchaseDate: this.normalizePurchaseDate(purchaseDate) }
          : {}),
        isMainVehicle: existingCount === 0,
      },
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

  findMainVehicleByOwnerId(ownerId: string) {
    return this.vehicle.findFirst({
      where: { ownerId, isMainVehicle: true },
    });
  }

  async setMainVehicleForOwner(ownerId: string, vehicleId: string) {
    const target = await this.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!target || target.ownerId !== ownerId) {
      throw new RpcException({
        status: HttpStatus.FORBIDDEN,
        message: 'Vehicle not found or does not belong to this owner',
      });
    }

    return this.$transaction(async (tx) => {
      await tx.vehicle.updateMany({
        where: { ownerId, isMainVehicle: true },
        data: { isMainVehicle: false },
      });

      return tx.vehicle.update({
        where: { id: vehicleId },
        data: { isMainVehicle: true },
      });
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

  findByIdOrNull(id: string) {
    return this.vehicle.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto) {
    if (updateVehicleDto.ownerId) {
      await this.validateOwnerExists(updateVehicleDto.ownerId);
    }

    await this.findOne(id);

    const { purchaseDate, ...rest } = updateVehicleDto;

    return this.vehicle.update({
      where: { id },
      data: {
        ...rest,
        ...(purchaseDate !== undefined
          ? {
              purchaseDate:
                purchaseDate === null || purchaseDate === ''
                  ? null
                  : this.normalizePurchaseDate(purchaseDate),
            }
          : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.vehicle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new RpcException(`Vehicle with id ${id} not found`);
    }

    const wasMain = existing.isMainVehicle;
    const ownerId = existing.ownerId;

    return this.$transaction(async (tx) => {
      await tx.vehicle.delete({
        where: { id },
      });

      if (wasMain) {
        const next = await tx.vehicle.findFirst({
          where: { ownerId },
          orderBy: { createdAt: 'desc' },
        });

        if (next) {
          await tx.vehicle.update({
            where: { id: next.id },
            data: { isMainVehicle: true },
          });
        }
      }

      return existing;
    });
  }
}
