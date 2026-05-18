import { IsBoolean, IsDate, IsNumber, IsOptional, IsString } from 'class-validator';

export class Vehicle {
    @IsString()
    public name!: string;
    @IsOptional()
    @IsString()
    public brand?: String;
    @IsOptional()
    public model?: String;
    @IsNumber()
    public year?: number;
    @IsNumber({
        maxDecimalPlaces: 1,
    })
    public currentMileage!: number;
    @IsOptional()
    @IsString()
    public licensePlate?: String;
    @IsOptional()
    @IsString()
    public vin?: String;

    @IsOptional()
    @IsDate()
    public purchaseDate?: Date;
    
    @IsOptional()
    @IsString()
    public imageUrl?: String;

    @IsOptional()
    @IsDate()
    public createdDate?: Date;

    @IsOptional()
    @IsDate()
    public updatedDate?: Date;

    @IsBoolean()
    public isArchived?: boolean;

    @IsOptional()
    @IsString()
    public engine?: string;

    @IsOptional()
    @IsString()
    public horsepower?: string;

    @IsOptional()
    @IsString()
    public torque?: string;

    @IsOptional()
    @IsString()
    public weight?: string;
}
