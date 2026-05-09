-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "currentMileage" DOUBLE PRECISION NOT NULL,
    "licensePlate" TEXT,
    "vin" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isMainVehicle" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- At most one vehicle marked main per owner (partial unique; not expressible in Prisma schema)
CREATE UNIQUE INDEX "Vehicle_ownerId_main_unique" ON "Vehicle" ("ownerId") WHERE "isMainVehicle" = true;
