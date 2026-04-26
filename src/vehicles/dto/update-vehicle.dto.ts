import { IsNumber, IsString, IsUUID } from 'class-validator';
import { CreateVehicleDto } from './create-vehicle.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @IsString()
  @IsUUID()
  id!: string;
}
