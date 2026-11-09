import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nairobiBusinessDate } from "./dates";

export class StockReportingError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    public code: "NOT_FOUND" | "FORBIDDEN" | "CLOSED" | "CONFLICT" | "NO_STATION" | "VALIDATION",
    fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = "StockReportingError";
    this.fieldErrors = fieldErrors;
  }
}

export async function listStationsForDealer(dealerOrganizationId: string) {
  return prisma.station.findMany({
    where: { dealerOrganizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      products: true,
      pumpCount: true,
      tankCount: true,
    },
  });
}

/** Prefer a coded station (stable identity); otherwise first by name. */
export function pickDefaultStation<T extends { code: string | null }>(stations: T[]): T | null {
  if (!stations.length) return null;
  return stations.find((s) => s.code) ?? stations[0] ?? null;
}

export async function getTodaysReport(params: {
  dealerOrganizationId: string;
  stationId: string;
  at?: Date;
}) {
  const reportingDate = nairobiBusinessDate(params.at);
  return prisma.stockSaleReport.findFirst({
    where: {
      dealerOrganizationId: params.dealerOrganizationId,
      stationId: params.stationId,
      reportingDate,
    },
  });
}

export async function listRecentReports(params: {
  dealerOrganizationId: string;
  stationId: string;
  take?: number;
}) {
  return prisma.stockSaleReport.findMany({
    where: {
      dealerOrganizationId: params.dealerOrganizationId,
      stationId: params.stationId,
      status: "CLOSED",
    },
    orderBy: [{ reportingDate: "desc" }, { closedAt: "desc" }],
    take: params.take ?? 10,
  });
}

export type ReportRecordsStatusFilter = "DRAFT" | "CLOSED" | "ALL";

function reportRecordsWhere(params: {
  dealerOrganizationId: string;
  stationId: string;
  status?: ReportRecordsStatusFilter;
  query?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}) {
  const status = params.status ?? "ALL";
  const q = params.query?.trim();
  return {
    dealerOrganizationId: params.dealerOrganizationId,
    stationId: params.stationId,
    ...(status === "ALL" ? {} : { status }),
    ...(params.dateFrom || params.dateTo
      ? {
          reportingDate: {
            ...(params.dateFrom ? { gte: params.dateFrom } : {}),
            ...(params.dateTo ? { lte: params.dateTo } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { reportReference: { contains: q, mode: "insensitive" as const } },
            { id: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/** Report Records: drafts + closed, with optional status / date / pagination. */
export async function listReportRecords(params: {
  dealerOrganizationId: string;
  stationId: string;
  take?: number;
  skip?: number;
  status?: ReportRecordsStatusFilter;
  query?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}) {
  const where = reportRecordsWhere(params);
  const take = Math.min(Math.max(params.take ?? 50, 1), 200);
  const skip = Math.max(params.skip ?? 0, 0);

  const [rows, total] = await Promise.all([
    prisma.stockSaleReport.findMany({
      where,
      orderBy: [{ reportingDate: "desc" }, { updatedAt: "desc" }],
      take,
      skip,
      include: {
        station: {
          select: {
            id: true,
            name: true,
            code: true,
            pumpCount: true,
            tankCount: true,
          },
        },
      },
    }),
    prisma.stockSaleReport.count({ where }),
  ]);

  return { rows, total, take, skip };
}

/** Unbounded (capped) list for exports — same filters as the UI table. */
export async function listReportRecordsForExport(params: {
  dealerOrganizationId: string;
  stationId: string;
  status?: ReportRecordsStatusFilter;
  query?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  max?: number;
}) {
  const where = reportRecordsWhere(params);
  return prisma.stockSaleReport.findMany({
    where,
    orderBy: [{ reportingDate: "desc" }, { updatedAt: "desc" }],
    take: Math.min(params.max ?? 5_000, 5_000),
    include: {
      station: {
        select: {
          id: true,
          name: true,
          code: true,
          pumpCount: true,
          tankCount: true,
        },
      },
    },
  });
}

export async function getReportForDealer(params: {
  dealerOrganizationId: string;
  reportId: string;
}) {
  const report = await prisma.stockSaleReport.findUnique({
    where: { id: params.reportId },
    include: { station: { select: { id: true, name: true } } },
  });
  if (!report) throw new StockReportingError("Report not found.", "NOT_FOUND");
  if (report.dealerOrganizationId !== params.dealerOrganizationId) {
    throw new StockReportingError("Report not found.", "FORBIDDEN");
  }
  return report;
}

export async function startTodaysReport(params: {
  dealerOrganizationId: string;
  stationId: string;
  userId: string;
  at?: Date;
}) {
  const station = await prisma.station.findFirst({
    where: { id: params.stationId, dealerOrganizationId: params.dealerOrganizationId },
    select: { id: true },
  });
  if (!station) throw new StockReportingError("Station not found.", "NO_STATION");

  const reportingDate = nairobiBusinessDate(params.at);
  const existing = await prisma.stockSaleReport.findUnique({
    where: {
      stationId_reportingDate: { stationId: params.stationId, reportingDate },
    },
  });
  if (existing) {
    if (existing.dealerOrganizationId !== params.dealerOrganizationId) {
      throw new StockReportingError("Report not found.", "FORBIDDEN");
    }
    return existing;
  }

  try {
    return await prisma.stockSaleReport.create({
      data: {
        dealerOrganizationId: params.dealerOrganizationId,
        stationId: params.stationId,
        reportingDate,
        createdById: params.userId,
        status: "DRAFT",
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.stockSaleReport.findUnique({
        where: {
          stationId_reportingDate: { stationId: params.stationId, reportingDate },
        },
      });
      if (again && again.dealerOrganizationId === params.dealerOrganizationId) return again;
    }
    throw err;
  }
}

/** Reset a draft report's stage completions. Closed reports cannot be reset here. */
export async function resetDraftReport(params: {
  dealerOrganizationId: string;
  reportId: string;
  expectedRevision: number;
}) {
  const report = await prisma.stockSaleReport.findUnique({ where: { id: params.reportId } });
  if (!report || report.dealerOrganizationId !== params.dealerOrganizationId) {
    throw new StockReportingError("Report not found.", "NOT_FOUND");
  }
  if (report.status === "CLOSED") {
    throw new StockReportingError(
      "Closed reports cannot be reset without an authorized correction process.",
      "CLOSED"
    );
  }
  if (report.revision !== params.expectedRevision) {
    throw new StockReportingError(
      "This report was updated elsewhere. Refresh and try again.",
      "CONFLICT"
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.stockSalePumpReading.updateMany({
      where: { reportId: report.id },
      data: { closingLitres: null, rttLitres: 0, salesLitres: null },
    });
    await tx.stockSaleTankReading.updateMany({
      where: { reportId: report.id },
      data: { closingLitres: null, salesLitres: null, ullageLitres: null },
    });
    return tx.stockSaleReport.update({
      where: { id: report.id },
      data: {
        pumpMetersCompletedAt: null,
        tankDipsCompletedAt: null,
        wetStockCompletedAt: null,
        monetaryCompletedAt: null,
        meterSalesPmsLitres: null,
        meterSalesAgoLitres: null,
        tankSalesPmsLitres: null,
        tankSalesAgoLitres: null,
        totalSalesLitres: null,
        expectedRevenueKes: null,
        collectionsKes: null,
        wetResolution: "NONE",
        wetState: "NOT_STARTED",
        wetVariancePmsLitres: null,
        wetVarianceAgoLitres: null,
        wetVarianceTotalLitres: null,
        wetAbsoluteVarianceLitres: null,
        wetLossReason: null,
        wetLossAcknowledgedAt: null,
        wetLossAcknowledgedById: null,
        sellingPricePmsKes: null,
        sellingPriceAgoKes: null,
        expectedPmsKes: null,
        expectedAgoKes: null,
        cashCollectionsKes: null,
        mpesaCollectionsKes: null,
        cardCollectionsKes: null,
        monetaryDifferenceKes: null,
        monetaryState: "NOT_STARTED",
        monetaryDiscrepancyReason: null,
        revision: { increment: 1 },
      },
    });
  });
}
