/**
 * Unit tests for VehiclesService — exercises the real service class
 * with Prisma layer mocked via jest.fn().
 *
 * Coverage:
 *  AC-1  findByOwnerId filters isDeleted:false, isArchived:false
 *  AC-2  softDeleteVehicle uses update() (soft, not delete())
 *  AC-3  softDeleteVehicle throws 403 before $transaction when ownerId mismatches
 *  AC-4  softDeleteVehicle throws 404 when vehicle not found
 *  AC-5  softDeleteVehicle promotes next active vehicle when deleted was main
 *  AC-6  softDeleteVehicle does NOT promote when deleted was not main
 *  AC-7  findByIdOrNull has NO isDeleted filter (historical snapshots)
 *  AC-8  create() counts only non-archived non-deleted vehicles
 *  AC-9  findMainVehicleByOwnerId filters isDeleted:false, isArchived:false
 *  AC-10a update() promotes unarchived vehicle to main when no active main exists
 *  AC-10b update() does NOT promote when an active main already exists
 *  AC-11 findByOwnerId omits isDeleted field from returned shape
 */

// Set required env vars BEFORE any module is loaded to pass joi validation
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.USERS_MS_PORT = '3001';
process.env.USERS_MS_HOST = 'localhost';

import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { VehiclesService } from './vehicles.service';

// ── Mock PrismaClient via the generated path ──────────────────────────────────

jest.mock('../generated/prisma', () => {
  return {
    PrismaClient: class {
      vehicle = {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      };
      $transaction = jest.fn();
      $connect = jest.fn().mockResolvedValue(undefined);
    },
  };
});

// ── Mock PrismaPg adapter ─────────────────────────────────────────────────────

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

// ── Mock UsersService ClientProxy ─────────────────────────────────────────────

import { of } from 'rxjs';

// Returns an observable that survives the rxjs timeout() pipe used in validateOwnerExists
const makeUserObservable = () => ({
  pipe: jest.fn().mockReturnValue(of({ id: 'owner-1' })),
});

const mockUsersService = {
  send: jest.fn().mockImplementation(() => makeUserObservable()),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_VEHICLE = {
  id: 'v-1',
  ownerId: 'owner-1',
  isMainVehicle: false,
  isArchived: false,
  isDeleted: false,
  createdAt: new Date('2025-01-01'),
  name: 'Bike',
  brand: 'Honda',
  model: 'CB500',
  year: 2023,
  currentMileage: 1000,
  licensePlate: null,
  vin: null,
  purchaseDate: null,
  imageUrl: null,
  updatedAt: new Date('2025-01-01'),
  engine: null,
  horsepower: null,
  torque: null,
  weight: null,
};

function makeVehicle(overrides: Partial<typeof BASE_VEHICLE> = {}) {
  return { ...BASE_VEHICLE, ...overrides };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('VehiclesService', () => {
  let service: VehiclesService;

  beforeEach(() => {
    service = new VehiclesService(mockUsersService as any);
    jest.clearAllMocks();
  });

  // ── AC-1 & AC-9: filter guards ────────────────────────────────────────────

  describe('findByOwnerId (AC-1)', () => {
    it('passes isDeleted:false and isArchived:false in the where clause', async () => {
      (service.vehicle.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByOwnerId('owner-1');

      const call = (service.vehicle.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toMatchObject({ ownerId: 'owner-1', isDeleted: false, isArchived: false });
    });

    it('FAILS if isDeleted filter is removed (guard test)', async () => {
      (service.vehicle.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByOwnerId('owner-1');

      const call = (service.vehicle.findMany as jest.Mock).mock.calls[0][0];
      // This assertion must succeed because isDeleted:false IS present
      expect(call.where).toHaveProperty('isDeleted', false);
    });

    it('FAILS if isArchived filter is removed (guard test)', async () => {
      (service.vehicle.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByOwnerId('owner-1');

      const call = (service.vehicle.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).toHaveProperty('isArchived', false);
    });
  });

  describe('findMainVehicleByOwnerId (AC-9)', () => {
    it('passes isDeleted:false and isArchived:false in the where clause', async () => {
      (service.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

      await service.findMainVehicleByOwnerId('owner-1');

      const call = (service.vehicle.findFirst as jest.Mock).mock.calls[0][0];
      expect(call.where).toMatchObject({ ownerId: 'owner-1', isDeleted: false, isArchived: false });
    });
  });

  // ── AC-11: isDeleted omitted from findByOwnerId response ─────────────────

  describe('findByOwnerId response shape (AC-11)', () => {
    it('does NOT include isDeleted in the returned vehicle objects', async () => {
      const vehicleWithoutDeleted = makeVehicle();
      // Simulate Prisma omit behaviour by removing isDeleted from returned shape
      const { isDeleted: _removed, ...vehicleShape } = vehicleWithoutDeleted;
      (service.vehicle.findMany as jest.Mock).mockResolvedValue([vehicleShape]);

      const result = await service.findByOwnerId('owner-1');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('isDeleted');
    });

    it('the findMany call uses omit to exclude isDeleted', async () => {
      (service.vehicle.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByOwnerId('owner-1');

      const call = (service.vehicle.findMany as jest.Mock).mock.calls[0][0];
      // omit must be present with isDeleted:true
      expect(call.omit).toBeDefined();
      expect(call.omit).toHaveProperty('isDeleted', true);
    });
  });

  // ── AC-3: ownership check throws 403 before transaction ──────────────────

  describe('softDeleteVehicle — ownership (AC-3)', () => {
    it('throws RpcException 403 when ownerId does not match, before $transaction', async () => {
      const vehicle = makeVehicle({ id: 'v-1', ownerId: 'owner-1' });
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(vehicle);

      await expect(service.softDeleteVehicle('v-1', 'owner-2')).rejects.toThrow(
        expect.objectContaining({ error: expect.objectContaining({ status: HttpStatus.FORBIDDEN }) }),
      );

      expect(service.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── AC-4: 404 when not found ──────────────────────────────────────────────

  describe('softDeleteVehicle — 404 (AC-4)', () => {
    it('throws RpcException 404 when vehicle does not exist', async () => {
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.softDeleteVehicle('v-nonexistent', 'owner-1')).rejects.toThrow(
        expect.objectContaining({ error: expect.objectContaining({ status: HttpStatus.NOT_FOUND }) }),
      );
    });
  });

  // ── AC-2: soft update, not physical delete ────────────────────────────────

  describe('softDeleteVehicle — soft (not hard) delete (AC-2)', () => {
    it('calls vehicle.update with isDeleted:true and does NOT call vehicle.delete', async () => {
      const vehicle = makeVehicle({ id: 'v-1', ownerId: 'owner-1', isMainVehicle: false });
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(vehicle);

      const mockTx = {
        vehicle: {
          update: jest.fn().mockResolvedValue({ ...vehicle, isDeleted: true }),
          findFirst: jest.fn().mockResolvedValue(null),
          delete: jest.fn(),
        },
      };

      (service.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

      await service.softDeleteVehicle('v-1', 'owner-1');

      // Must call update with isDeleted:true
      expect(mockTx.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDeleted: true }) }),
      );
      // Must NOT call delete()
      expect(mockTx.vehicle.delete).not.toHaveBeenCalled();
    });
  });

  // ── AC-5: main promotion ─────────────────────────────────────────────────

  describe('softDeleteVehicle — main vehicle promotion (AC-5)', () => {
    it('promotes next active vehicle when deleted vehicle was main', async () => {
      const deleted = makeVehicle({ id: 'v-1', ownerId: 'owner-1', isMainVehicle: true });
      const next = makeVehicle({ id: 'v-2', ownerId: 'owner-1', isMainVehicle: false, createdAt: new Date('2025-06-01') });

      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(deleted);

      const mockTx = {
        vehicle: {
          update: jest.fn().mockResolvedValue({ ...deleted, isDeleted: true, isMainVehicle: false }),
          findFirst: jest.fn().mockResolvedValue(next),
        },
      };

      (service.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

      await service.softDeleteVehicle('v-1', 'owner-1');

      // findFirst must be called with correct where + orderBy
      expect(mockTx.vehicle.findFirst).toHaveBeenCalledWith({
        where: { ownerId: 'owner-1', isArchived: false, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });

      // update must be called twice: once to soft-delete, once to promote
      expect(mockTx.vehicle.update).toHaveBeenCalledTimes(2);
      expect(mockTx.vehicle.update).toHaveBeenLastCalledWith({
        where: { id: 'v-2' },
        data: { isMainVehicle: true },
      });
    });

    it('FAILS if promotion query order is wrong (guard)', async () => {
      const deleted = makeVehicle({ id: 'v-1', ownerId: 'owner-1', isMainVehicle: true });
      const next = makeVehicle({ id: 'v-2', ownerId: 'owner-1', isMainVehicle: false });

      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(deleted);

      const mockTx = {
        vehicle: {
          update: jest.fn().mockResolvedValue({ ...deleted, isDeleted: true }),
          findFirst: jest.fn().mockResolvedValue(next),
        },
      };

      (service.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

      await service.softDeleteVehicle('v-1', 'owner-1');

      const findFirstCall = mockTx.vehicle.findFirst.mock.calls[0][0];
      // The canonical order must be desc
      expect(findFirstCall.orderBy).toEqual({ createdAt: 'desc' });
      // asc would be wrong — this assertion would fail if 'asc' were used
      expect(findFirstCall.orderBy).not.toEqual({ createdAt: 'asc' });
    });
  });

  // ── AC-6: no promotion when not main ─────────────────────────────────────

  describe('softDeleteVehicle — no promotion when not main (AC-6)', () => {
    it('does NOT call findFirst for promotion when deleted vehicle was not main', async () => {
      const vehicle = makeVehicle({ id: 'v-1', ownerId: 'owner-1', isMainVehicle: false });
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(vehicle);

      const mockTx = {
        vehicle: {
          update: jest.fn().mockResolvedValue({ ...vehicle, isDeleted: true }),
          findFirst: jest.fn(),
        },
      };

      (service.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));

      await service.softDeleteVehicle('v-1', 'owner-1');

      expect(mockTx.vehicle.findFirst).not.toHaveBeenCalled();
      // update called exactly once (the soft-delete itself)
      expect(mockTx.vehicle.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── AC-7: findByIdOrNull has NO isDeleted filter ──────────────────────────

  describe('findByIdOrNull (AC-7)', () => {
    it('calls findUnique with only { id } — no isDeleted filter', async () => {
      const deletedVehicle = makeVehicle({ id: 'v-1', isDeleted: true });
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(deletedVehicle);

      const result = await service.findByIdOrNull('v-1');

      const call = (service.vehicle.findUnique as jest.Mock).mock.calls[0][0];
      expect(call.where).toEqual({ id: 'v-1' });
      expect(call.where).not.toHaveProperty('isDeleted');
      expect(result).not.toBeNull();
      expect(result?.isDeleted).toBe(true);
    });

    it('FAILS if an isDeleted filter is added (guard)', async () => {
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(null);

      await service.findByIdOrNull('v-1');

      const call = (service.vehicle.findUnique as jest.Mock).mock.calls[0][0];
      // This must NOT have isDeleted — if it did, the next assertion would fail
      expect(call.where).not.toHaveProperty('isDeleted');
    });
  });

  // ── AC-8: create() counts only active vehicles ────────────────────────────

  describe('create() — isMainVehicle assignment (AC-8)', () => {
    it('counts vehicles with isArchived:false, isDeleted:false', async () => {
      (service.vehicle.count as jest.Mock).mockResolvedValue(0);
      (service.vehicle.create as jest.Mock).mockResolvedValue(makeVehicle({ isMainVehicle: true }));

      await service.create({
        ownerId: 'owner-1',
        name: 'New Bike',
        brand: 'Yamaha',
        model: 'MT-07',
        year: 2024,
        currentMileage: 0,
      } as any);

      const countCall = (service.vehicle.count as jest.Mock).mock.calls[0][0];
      expect(countCall.where).toMatchObject({
        ownerId: 'owner-1',
        isArchived: false,
        isDeleted: false,
      });
    });

    it('sets isMainVehicle:true when count is 0 (all prior archived/deleted)', async () => {
      (service.vehicle.count as jest.Mock).mockResolvedValue(0);
      (service.vehicle.create as jest.Mock).mockResolvedValue(makeVehicle({ isMainVehicle: true }));

      await service.create({ ownerId: 'owner-1', name: 'B', brand: 'Y', model: 'M', year: 2024, currentMileage: 0 } as any);

      const createCall = (service.vehicle.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data).toMatchObject({ isMainVehicle: true });
    });

    it('sets isMainVehicle:false when owner already has active vehicles', async () => {
      (service.vehicle.count as jest.Mock).mockResolvedValue(2);
      (service.vehicle.create as jest.Mock).mockResolvedValue(makeVehicle({ isMainVehicle: false }));

      await service.create({ ownerId: 'owner-1', name: 'B', brand: 'Y', model: 'M', year: 2024, currentMileage: 0 } as any);

      const createCall = (service.vehicle.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data).toMatchObject({ isMainVehicle: false });
    });
  });

  // ── AC-10a: update() promotes unarchived vehicle when no active main ──────

  describe('update() — unarchive promotion (AC-10a)', () => {
    it('promotes vehicle to isMainVehicle:true when unarchiving and no active main exists', async () => {
      const archived = makeVehicle({ id: 'v-arch', ownerId: 'owner-1', isArchived: true, isMainVehicle: false });
      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(archived);

      const mockTx = {
        vehicle: {
          update: jest.fn()
            .mockResolvedValueOnce({ ...archived, isArchived: false })
            .mockResolvedValueOnce({ ...archived, isArchived: false, isMainVehicle: true }),
          findFirst: jest.fn().mockResolvedValue(null), // no active main
        },
      };

      (service.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );

      await service.update('v-arch', { isArchived: false, ownerId: 'owner-1' } as any);

      // findFirst must check for an active main vehicle
      expect(mockTx.vehicle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: 'owner-1', isMainVehicle: true, isArchived: false, isDeleted: false }),
        }),
      );

      // second update must promote to isMainVehicle:true
      expect(mockTx.vehicle.update).toHaveBeenCalledTimes(2);
      expect(mockTx.vehicle.update).toHaveBeenLastCalledWith({
        where: { id: 'v-arch' },
        data: { isMainVehicle: true },
      });
    });
  });

  // ── AC-10b: update() does NOT promote when active main already exists ─────

  describe('update() — no promotion when main already exists (AC-10b)', () => {
    it('does NOT promote when unarchiving and an active main vehicle already exists', async () => {
      const archived = makeVehicle({ id: 'v-arch', ownerId: 'owner-1', isArchived: true, isMainVehicle: false });
      const existingMain = makeVehicle({ id: 'v-main', ownerId: 'owner-1', isArchived: false, isMainVehicle: true });

      (service.vehicle.findUnique as jest.Mock).mockResolvedValue(archived);

      const mockTx = {
        vehicle: {
          update: jest.fn().mockResolvedValue({ ...archived, isArchived: false }),
          findFirst: jest.fn().mockResolvedValue(existingMain), // active main exists
        },
      };

      (service.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      );

      await service.update('v-arch', { isArchived: false, ownerId: 'owner-1' } as any);

      // update called only once (the unarchive itself, no promotion)
      expect(mockTx.vehicle.update).toHaveBeenCalledTimes(1);
    });
  });
});
