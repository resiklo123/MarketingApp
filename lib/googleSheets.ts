import "server-only";
import { google, sheets_v4 } from "googleapis";
import { prisma } from "@/lib/prisma";

const POSTING_LOG_TAB = "PostingLog";

const REQUIRED_HEADERS = [
  "PostId",
  "CreatedAt",
  "UpdatedAt",
  "Status",
  "MachineFamily",
  "MachineModel",
  "Topic",
  "Location",
  "Platforms",
  "DriveFolderUrl",
  "PrimaryAssetDriveUrl",
  "FB_Url",
  "IG_Url",
  "TikTok_Url",
  "YouTube_Url",
  "Website_Url",
  "Notes",
] as const;

function parseServiceAccountJson(raw: string | undefined): object {
  if (!raw || !raw.trim()) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is empty");
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as object;
  } catch {
    try {
      const unescaped = JSON.parse(`"${trimmed.replace(/"/g, '\\"')}"`) as string;
      return JSON.parse(unescaped) as object;
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }
}

function getMasterSheetId(): string | null {
  const sheetId = process.env.CONTENTOPS_MASTER_SHEET_ID?.trim();
  if (!sheetId) {
    console.warn("[contentops] CONTENTOPS_MASTER_SHEET_ID missing; skipping Sheets mirror sync.");
    return null;
  }
  return sheetId;
}

function getSheetsClient(): sheets_v4.Sheets {
  const credentials = parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function driveFileUrl(fileId: string, webViewLink?: string | null): string {
  return webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

function normalizeCell(value: unknown): string {
  return value == null ? "" : String(value);
}

function headerMapFromRow(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((header, idx) => map.set(header.trim(), idx));
  return map;
}

function getRowValue(row: string[], map: Map<string, number>, header: string): string {
  const idx = map.get(header);
  if (idx == null) return "";
  return normalizeCell(row[idx]);
}

async function ensurePostingLogTabAndHeaders(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[]);
  if (!titles.has(POSTING_LOG_TAB)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: POSTING_LOG_TAB } } }],
      },
    });
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${POSTING_LOG_TAB}'!1:1`,
  });
  const current = (headerRes.data.values?.[0] ?? []).map((v) => normalizeCell(v).trim());
  const existingSet = new Set(current.filter((h) => h.length > 0));
  const missing = REQUIRED_HEADERS.filter((h) => !existingSet.has(h));
  if (missing.length > 0) {
    const nextHeaders = [...current, ...missing];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${POSTING_LOG_TAB}'!1:1`,
      valueInputOption: "RAW",
      requestBody: { values: [nextHeaders] },
    });
  }
}

function newestDateIso(dates: Array<Date | null | undefined>): string {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  if (valid.length === 0) return new Date().toISOString();
  valid.sort((a, b) => b.getTime() - a.getTime());
  return valid[0]!.toISOString();
}

export async function upsertPostingLogRow(postId: string): Promise<void> {
  const spreadsheetId = getMasterSheetId();
  if (!spreadsheetId) return;

  const sheets = getSheetsClient();
  await ensurePostingLogTabAndHeaders(sheets, spreadsheetId);

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      assets: {
        orderBy: [{ id: "asc" }],
      },
      drafts: {
        select: { updatedAt: true },
      },
      logs: {
        select: { platform: true, postedUrl: true, notes: true, updatedAt: true },
      },
    },
  });
  if (!post) return;

  const sheetRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${POSTING_LOG_TAB}'`,
  });
  const sheetRows = (sheetRes.data.values ?? []).map((row) => row.map((v) => normalizeCell(v)));
  const headerRow = sheetRows[0] ?? REQUIRED_HEADERS.slice();
  const map = headerMapFromRow(headerRow);

  const exactRowIndex = sheetRows.slice(1).findIndex((row) => getRowValue(row, map, "PostId") === post.id);
  const existingRow = exactRowIndex >= 0 ? sheetRows[exactRowIndex + 1] : [];

  const logByPlatform = new Map(post.logs.map((log) => [log.platform, log]));
  const preferredNote =
    logByPlatform.get("FB")?.notes?.trim() ||
    logByPlatform.get("IG")?.notes?.trim() ||
    logByPlatform.get("TIKTOK")?.notes?.trim() ||
    logByPlatform.get("YOUTUBE")?.notes?.trim() ||
    logByPlatform.get("WEBSITE")?.notes?.trim() ||
    post.logs.find((log) => (log.notes ?? "").trim().length > 0)?.notes?.trim() ||
    "";

  const firstAsset = post.assets[0];
  const firstAssetUrl = firstAsset ? driveFileUrl(firstAsset.driveFileId, firstAsset.webViewLink) : "";

  const dbDriveFolderUrl: string | null = null;
  const existingDriveFolderUrl = getRowValue(existingRow, map, "DriveFolderUrl");
  const driveFolderUrl = dbDriveFolderUrl || existingDriveFolderUrl || "";

  const updatedAt = newestDateIso([...post.drafts.map((d) => d.updatedAt), ...post.logs.map((l) => l.updatedAt), post.createdAt]);

  const valueByHeader = new Map<string, string>([
    ["PostId", post.id],
    ["CreatedAt", post.createdAt.toISOString()],
    ["UpdatedAt", updatedAt],
    ["Status", post.status],
    ["MachineFamily", post.machineFamily],
    ["MachineModel", post.machineModel ?? ""],
    ["Topic", post.topic],
    ["Location", post.location ?? ""],
    ["Platforms", post.platforms.join(",")],
    ["DriveFolderUrl", driveFolderUrl],
    ["PrimaryAssetDriveUrl", firstAssetUrl],
    ["FB_Url", logByPlatform.get("FB")?.postedUrl ?? ""],
    ["IG_Url", logByPlatform.get("IG")?.postedUrl ?? ""],
    ["TikTok_Url", logByPlatform.get("TIKTOK")?.postedUrl ?? ""],
    ["YouTube_Url", logByPlatform.get("YOUTUBE")?.postedUrl ?? ""],
    ["Website_Url", logByPlatform.get("WEBSITE")?.postedUrl ?? ""],
    ["Notes", preferredNote],
  ]);

  const writeValuesIntoRow = (base: string[]): string[] => {
    const row = base.slice();
    const requiredSize = Math.max(headerRow.length, row.length);
    if (row.length < requiredSize) {
      row.push(...Array.from({ length: requiredSize - row.length }, () => ""));
    }
    for (const [header, value] of valueByHeader.entries()) {
      const idx = map.get(header);
      if (idx == null) continue;
      if (idx >= row.length) {
        row.push(...Array.from({ length: idx - row.length + 1 }, () => ""));
      }
      row[idx] = value;
    }
    return row;
  };

  if (exactRowIndex >= 0) {
    const rowNumber = exactRowIndex + 2;
    const outputRow = writeValuesIntoRow(existingRow);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${POSTING_LOG_TAB}'!${rowNumber}:${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [outputRow] },
    });
    return;
  }

  const outputRow = writeValuesIntoRow(Array.from({ length: headerRow.length }, () => ""));
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${POSTING_LOG_TAB}'`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [outputRow] },
  });
}
