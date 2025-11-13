-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "faceEncoding" TEXT,
ADD COLUMN     "faceEnrolled" BOOLEAN NOT NULL DEFAULT false;
