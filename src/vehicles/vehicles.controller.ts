import { Controller, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { SoatService } from './soat.service';
import { TecnomecanicaService } from './tecnomecanica.service';
import { CreateVehicleDto, SetMainVehiclePayloadDto, UpdateVehiclePayloadDto } from '@rideglory/contracts';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateSoatDto } from './dto/create-soat.dto';
import { CreateTecnomecanicaDto } from './dto/create-tecnomecanica.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly soatService: SoatService,
    private readonly tecnomecanicaService: TecnomecanicaService,
  ) {}

  @MessagePattern('createVehicle')
  create(@Payload() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  @MessagePattern('findAllVehicles')
  findAll() {
    return this.vehiclesService.findAll();
  }

  @MessagePattern('findVehiclesByOwnerId')
  findByOwnerId(@Payload('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.vehiclesService.findByOwnerId(ownerId);
  }

  @MessagePattern('findMainVehicleByOwnerId')
  findMainVehicleByOwnerId(@Payload('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.vehiclesService.findMainVehicleByOwnerId(ownerId);
  }

  @MessagePattern('setMainVehicleForOwner')
  setMainVehicleForOwner(@Payload() dto: SetMainVehiclePayloadDto) {
    return this.vehiclesService.setMainVehicleForOwner(dto.ownerId, dto.vehicleId);
  }

  @MessagePattern('findOneVehicle')
  async findOne(@Payload('id', ParseUUIDPipe) id: string) {
    const vehicle = await this.vehiclesService.findOne(id);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    return vehicle;
  }

  @MessagePattern('getVehicleById')
  getVehicleById(@Payload('vehicleId', ParseUUIDPipe) vehicleId: string) {
    return this.vehiclesService.findByIdOrNull(vehicleId);
  }

  // ── SOAT ──────────────────────────────────────────────────────────────────────

  @MessagePattern('upsertSoat')
  upsertSoat(
    @Payload()
    payload: { vehicleId: string; ownerId: string; dto: CreateSoatDto },
  ) {
    return this.soatService.upsertSoat(
      payload.vehicleId,
      payload.ownerId,
      payload.dto,
    );
  }

  @MessagePattern('findSoatByVehicle')
  findSoatByVehicle(
    @Payload() payload: { vehicleId: string; ownerId: string },
  ) {
    return this.soatService.findSoatByVehicle(
      payload.vehicleId,
      payload.ownerId,
    );
  }

  @MessagePattern('deleteSoat')
  deleteSoat(@Payload() payload: { vehicleId: string; ownerId: string }) {
    return this.soatService.deleteSoat(payload.vehicleId, payload.ownerId);
  }

  @MessagePattern('findSoatsExpiringIn')
  findSoatsExpiringIn(@Payload('daysUntilExpiry') daysUntilExpiry: number) {
    return this.soatService.findSoatsExpiringIn(daysUntilExpiry);
  }

  // ── RTM (Tecnomecánica) ───────────────────────────────────────────────────

  @MessagePattern('upsertTecnomecanica')
  upsertTecnomecanica(
    @Payload()
    payload: { vehicleId: string; ownerId: string; dto: CreateTecnomecanicaDto },
  ) {
    return this.tecnomecanicaService.upsertTecnomecanica(
      payload.vehicleId,
      payload.ownerId,
      payload.dto,
    );
  }

  @MessagePattern('findTecnomecanicaByVehicle')
  findTecnomecanicaByVehicle(
    @Payload() payload: { vehicleId: string; ownerId: string },
  ) {
    return this.tecnomecanicaService.findTecnomecanicaByVehicle(
      payload.vehicleId,
      payload.ownerId,
    );
  }

  @MessagePattern('deleteTecnomecanica')
  deleteTecnomecanica(
    @Payload() payload: { vehicleId: string; ownerId: string },
  ) {
    return this.tecnomecanicaService.deleteTecnomecanica(
      payload.vehicleId,
      payload.ownerId,
    );
  }

  @MessagePattern('findTecnomecanicasExpiringIn')
  findTecnomecanicasExpiringIn(
    @Payload('daysUntilExpiry') daysUntilExpiry: number,
  ) {
    return this.tecnomecanicaService.findTecnomecanicasExpiringIn(daysUntilExpiry);
  }

  @MessagePattern('softDeleteVehicle')
  softDeleteVehicle(@Payload() payload: { vehicleId: string; ownerId: string }) {
    return this.vehiclesService.softDeleteVehicle(payload.vehicleId, payload.ownerId);
  }

  @MessagePattern('updateVehicle')
  update(@Payload() updateVehicleDto: UpdateVehiclePayloadDto) {
    const { id, ...data } = updateVehicleDto;
    return this.vehiclesService.update(id, data);
  }

  @MessagePattern('hardDeleteVehicle')
  async remove(@Payload('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.remove(id);
  }
}
