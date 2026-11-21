import { prisma } from "./prisma";

const TAKE_HOME_JSON_KEYS = [
  "ownerTakeHomeAmount",
  "takeHomeAmount",
  "cashTakenHome",
  "receivingAmount",
  "ownerReceiving",
  "cashTakenByOwner",
  "withdrawnByOwner",
  "ownerWithdrawal",
  "handoverAmount",
] as const;

const FLOAT_JSON_KEYS = [
  "remainingFloatForTomorrow",
  "nextDayOpeningCash",
  "remainingFloat",
  "tomorrowOpeningFloat",
] as const;

function extractNumericFromObject(
  obj: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): number | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null && val !== "") {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) {
        return n;
      }
    }
  }
  return null;
}

export interface BackfillResultItem {
  id: string;
  branch: string;
  date: string;
  recoveredOwnerTakeHomeAmount: number | null;
  recoveredRemainingFloatForTomorrow: number | null;
  source: string;
}

export async function backfillHistoricalReceivingAmounts(
  branchFilter?: string | null
): Promise<BackfillResultItem[]> {
  const whereClause =
    branchFilter && branchFilter !== "ALL" ? { branch: branchFilter } : {};

  // Fetch all rows for the branch(es) ordered chronologically so we can also inspect next-day openingCash continuity
  const allRows = await prisma.dailyRegisterLock.findMany({
    where: whereClause,
    orderBy: [{ branch: "asc" }, { lockedAt: "asc" }],
  });

  const byBranch = new Map<string, typeof allRows>();
  for (const row of allRows) {
    const list = byBranch.get(row.branch) || [];
    list.push(row);
    byBranch.set(row.branch, list);
  }

  const updated: BackfillResultItem[] = [];

  for (const [, branchRows] of byBranch) {
    for (let i = 0; i < branchRows.length; i++) {
      const row = branchRows[i];
      const nextRow = i + 1 < branchRows.length ? branchRows[i + 1] : null;

      const needsTakeHome =
        row.ownerTakeHomeAmount === null ||
        row.ownerTakeHomeAmount === undefined ||
        Number(row.ownerTakeHomeAmount) <= 0;
      const needsFloat =
        row.remainingFloatForTomorrow === null ||
        row.remainingFloatForTomorrow === undefined;

      if (!needsTakeHome && !needsFloat) continue;

      let parsedJson: Record<string, unknown> | null = null;
      if (row.dataJson) {
        try {
          parsedJson = JSON.parse(row.dataJson) as Record<string, unknown>;
        } catch {
          parsedJson = null;
        }
      }

      // 1. Recover take-home amount
      let recoveredTakeHome: number | null = null;
      let source = "";

      if (needsTakeHome) {
        if (row.takeHomeAmount !== null && row.takeHomeAmount !== undefined && Number(row.takeHomeAmount) > 0) {
          recoveredTakeHome = Number(row.takeHomeAmount);
          source = "DailyRegisterLock.takeHomeAmount";
        } else {
          const jsonTakeHome = extractNumericFromObject(parsedJson, TAKE_HOME_JSON_KEYS);
          if (jsonTakeHome !== null && jsonTakeHome > 0) {
            recoveredTakeHome = jsonTakeHome;
            source = "DailyRegisterLock.dataJson";
          } else if (
            row.nextDayOpeningCash !== null &&
            row.nextDayOpeningCash !== undefined &&
            row.closingCash > Number(row.nextDayOpeningCash)
          ) {
            recoveredTakeHome = Number((row.closingCash - Number(row.nextDayOpeningCash)).toFixed(2));
            source = "closingCash_minus_nextDayOpeningCash";
          } else if (nextRow && row.closingCash > nextRow.openingCash) {
            recoveredTakeHome = Number((row.closingCash - nextRow.openingCash).toFixed(2));
            source = "nextDay_openingCash_continuity";
          }
        }
      }

      // 2. Recover remainingFloatForTomorrow
      let recoveredFloat: number | null = null;
      if (needsFloat) {
        if (row.nextDayOpeningCash !== null && row.nextDayOpeningCash !== undefined) {
          recoveredFloat = Number(row.nextDayOpeningCash);
        } else {
          const jsonFloat = extractNumericFromObject(parsedJson, FLOAT_JSON_KEYS);
          if (jsonFloat !== null) {
            recoveredFloat = jsonFloat;
          } else if (recoveredTakeHome !== null && recoveredTakeHome > 0) {
            recoveredFloat = Math.max(
              0,
              Number((row.closingCash - recoveredTakeHome).toFixed(2))
            );
          } else if (nextRow) {
            recoveredFloat = Number(nextRow.openingCash);
          }
        }
      }

      const updateData: Record<string, unknown> = {};
      if (needsTakeHome && recoveredTakeHome !== null && recoveredTakeHome > 0) {
        updateData.ownerTakeHomeAmount = recoveredTakeHome;
        if (row.takeHomeAmount === null || row.takeHomeAmount === undefined || Number(row.takeHomeAmount) <= 0) {
          updateData.takeHomeAmount = recoveredTakeHome;
        }
      }
      if (needsFloat && recoveredFloat !== null) {
        updateData.remainingFloatForTomorrow = recoveredFloat;
      }

      if (Object.keys(updateData).length === 0) continue;

      await prisma.dailyRegisterLock.update({
        where: { id: row.id },
        data: updateData,
      });

      await prisma.securityAuditLog.create({
        data: {
          event: "HISTORICAL_RECEIVING_AMOUNT_AUTO_BACKFILLED",
          profileId: "SYSTEM_BACKFILL",
          branch: row.branch,
          details: JSON.stringify({
            recordId: row.id,
            date: row.date,
            ownerTakeHomeAmount: updateData.ownerTakeHomeAmount ?? row.ownerTakeHomeAmount,
            remainingFloatForTomorrow:
              updateData.remainingFloatForTomorrow ?? row.remainingFloatForTomorrow,
            source: source || "nextDayOpeningCash",
          }),
        },
      });

      updated.push({
        id: row.id,
        branch: row.branch,
        date: row.date,
        recoveredOwnerTakeHomeAmount:
          (updateData.ownerTakeHomeAmount as number | undefined) ?? null,
        recoveredRemainingFloatForTomorrow:
          (updateData.remainingFloatForTomorrow as number | undefined) ?? null,
        source: source || "nextDayOpeningCash",
      });
    }
  }

  return updated;
}
