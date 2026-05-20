import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { envs } from './config/envs';
import { RpcAllExceptionsFilter } from '@rideglory/common-lib';

async function bootstrap() {
  const logger = new Logger('Main');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: envs.port,
      },
    }
  );

  app.useGlobalPipes(
    new ValidationPipe(
      {
        whitelist: true,
        forbidNonWhitelisted: true,
      }
    )
  )

  app.useGlobalFilters(new RpcAllExceptionsFilter());

  await app.listen();
  logger.log(`Vehicles Microservice is running on port ${envs.port}`);
}
bootstrap();
