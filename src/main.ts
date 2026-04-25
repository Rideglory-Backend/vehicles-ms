import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { env } from 'prisma/config';
import { envs } from './config/envs';

async function bootstrap() {
  const logger = new Logger('Main');
  ;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule,
    {
      transport: Transport.TCP,
      options: {
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

  await app.listen();
  logger.log(`Vehicles Microservice is running on port ${envs.port}`);
}
bootstrap();
