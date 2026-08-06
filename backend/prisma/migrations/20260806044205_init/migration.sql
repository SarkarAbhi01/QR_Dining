-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "parentOrderId" TEXT;

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "canDownloadReports" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "orders_parentOrderId_idx" ON "orders"("parentOrderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
