import { Controller, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, SetMainVehiclePayloadDto, UpdateVehiclePayloadDto } from '@rideglory/contracts';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) { }

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
