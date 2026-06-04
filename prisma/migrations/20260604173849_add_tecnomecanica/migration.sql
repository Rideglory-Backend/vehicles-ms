-- CreateTable
CREATE TABLE "Tecnomecanica" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "cdaName" TEXT NOT NULL,
    "cdaCode" TEXT,
    "startDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tecnomecanica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tecnomecanica_vehicleId_key" ON "Tecnomecanica"("vehicleId");
