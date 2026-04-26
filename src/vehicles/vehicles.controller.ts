import { Controller, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
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

  @MessagePattern('findOneVehicle')
  async findOne(@Payload('id', ParseUUIDPipe) id: string) {
    const vehicle = await this.vehiclesService.findOne(id);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with id ${id} not found`);
    }

    return vehicle;
  }

  @MessagePattern('updateVehicle')
  update(@Payload() updateVehicleDto: UpdateVehicleDto) {
    return this.vehiclesService.update(updateVehicleDto.id, updateVehicleDto);
  }

  @MessagePattern('hardDeleteVehicle')
  async remove(@Payload('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.remove(id);
  }
}
