/**
 * Seed file for vehicles-ms — creates 2 test vehicles.
 * Run: npx ts-node prisma/seed.ts
 *
 * Prerequisite: a user must exist in users-ms with the seed userId below.
 * Update SEED_USER_ID to match a real user ID in the local database.
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const SEED_USER_ID = process.env.SEED_USER_ID ?? '00000000-0000-0000-0000-000000000001';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  await prisma.$connect();

  console.log('Seeding vehicles-ms...');

  const vehicle1 = await prisma.vehicle.upsert({
    where: { id: '00000000-0000-0000-0001-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000001',
      ownerId: SEED_USER_ID,
      name: 'Mi Honda CB300R',
      brand: 'Honda',
      model: 'CB300R',
      year: 2022,
      currentMileage: 12000,
      licensePlate: 'ABC123',
      isMainVehicle: true,
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { id: '00000000-0000-0000-0001-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000002',
      ownerId: SEED_USER_ID,
      name: 'Yamaha R3',
      brand: 'Yamaha',
      model: 'R3',
      year: 2021,
      currentMileage: 8500,
      licensePlate: 'DEF456',
      isMainVehicle: false,
    },
  });

  console.log('Created vehicles:', { vehicle1: vehicle1.id, vehicle2: vehicle2.id });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
