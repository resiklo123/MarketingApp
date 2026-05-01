import { google, drive_v3 } from "googleapis";

export type IncomingDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string | null;
  webViewLink?: string | null;
  thumbnailLink?: string | null;
};

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

export function getDriveClient(): drive_v3.Drive {
  const credentials = parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[/\\?%*:|"'<>]/g, "-").replace(/\s+/g, " ").trim().slice(0, 200) || "unnamed";
}

function normalizeMachineFamily(family: string): string {
  const sanitized = sanitizePathSegment(family);
  if (/^baler(s)?$/i.test(sanitized)) return "Balers";
  return sanitized;
}

function normalizeModel(model?: string | null): string {
  const cleaned = sanitizePathSegment(model?.trim() || "");
  return cleaned || "UnknownModel";
}

function folderQuery(parentId: string, mimeType?: string, name?: string): string {
  const q = [`'${parentId}' in parents`, "trashed = false"];
  if (mimeType) q.push(`mimeType = '${mimeType}'`);
  if (name) q.push(`name = '${name.replace(/'/g, "\\'")}'`);
  return q.join(" and ");
}

async function findOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string> {
  const safe = sanitizePathSegment(name);
  const existing = await drive.files.list({
    q: folderQuery(parentId, "application/vnd.google-apps.folder", safe),
    pageSize: 1,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const hit = existing.data.files?.[0];
  if (hit?.id) return hit.id;

  const created = await drive.files.create({
    requestBody: {
      name: safe,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Failed to create folder: ${safe}`);
  return created.data.id;
}

export async function listIncomingFiles(limit = 50): Promise<IncomingDriveFile[]> {
  const folderId = process.env.DRIVE_INCOMING_FOLDER_ID;
  if (!folderId) throw new Error("DRIVE_INCOMING_FOLDER_ID is not set");
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    pageSize: limit,
    fields: "nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    size: f.size ?? undefined,
    createdTime: f.createdTime,
    webViewLink: f.webViewLink,
    thumbnailLink: f.thumbnailLink,
  }));
}

export type CanonicalFolderContext = {
  machineFamily: string;
  machineModel?: string | null;
  createdAt: Date;
  slug: string;
};

export async function ensureCanonicalPostFolder(input: CanonicalFolderContext): Promise<string> {
  const root = process.env.DRIVE_LIBRARY_FOLDER_ID;
  if (!root) throw new Error("DRIVE_LIBRARY_FOLDER_ID is not set");
  const drive = getDriveClient();
  const family = normalizeMachineFamily(input.machineFamily);
  const model = normalizeModel(input.machineModel);
  const year = input.createdAt.getUTCFullYear().toString();
  const month = String(input.createdAt.getUTCMonth() + 1).padStart(2, "0");

  const familyId = await findOrCreateFolder(drive, family, root);
  const modelId = await findOrCreateFolder(drive, model, familyId);
  const yearId = await findOrCreateFolder(drive, year, modelId);
  const monthId = await findOrCreateFolder(drive, month, yearId);
  return findOrCreateFolder(drive, input.slug, monthId);
}

export async function ensureByMachineFolder(machineFamily: string, machineModel?: string | null): Promise<string> {
  const root = process.env.DRIVE_LIBRARY_FOLDER_ID;
  if (!root) throw new Error("DRIVE_LIBRARY_FOLDER_ID is not set");
  const drive = getDriveClient();

  const byMachineId = await findOrCreateFolder(drive, "_ByMachine", root);
  const familyId = await findOrCreateFolder(drive, normalizeMachineFamily(machineFamily), byMachineId);
  return findOrCreateFolder(drive, normalizeModel(machineModel), familyId);
}

export async function ensureByDateFolder(year: string, month: string): Promise<string> {
  const root = process.env.DRIVE_LIBRARY_FOLDER_ID;
  if (!root) throw new Error("DRIVE_LIBRARY_FOLDER_ID is not set");
  const drive = getDriveClient();

  const byDateId = await findOrCreateFolder(drive, "_ByDate", root);
  const yearId = await findOrCreateFolder(drive, year, byDateId);
  return findOrCreateFolder(drive, month, yearId);
}

export async function createShortcut(parentFolderId: string, targetId: string, name: string): Promise<string> {
  const drive = getDriveClient();
  const shortcutName = sanitizePathSegment(name);

  const existing = await drive.files.list({
    q: folderQuery(parentFolderId, "application/vnd.google-apps.shortcut", shortcutName),
    pageSize: 10,
    fields: "files(id,shortcutDetails/targetId)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const hit = existing.data.files?.find((f) => f.shortcutDetails?.targetId === targetId) ?? existing.data.files?.[0];
  if (hit?.id) return hit.id;

  const created = await drive.files.create({
    requestBody: {
      name: shortcutName,
      mimeType: "application/vnd.google-apps.shortcut",
      parents: [parentFolderId],
      shortcutDetails: { targetId },
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Failed creating shortcut ${shortcutName}`);
  return created.data.id;
}

export async function moveAndRenameFile(fileId: string, newParentId: string, newName: string): Promise<drive_v3.Schema$File> {
  const drive = getDriveClient();
  const meta = await drive.files.get({ fileId, fields: "parents", supportsAllDrives: true });
  const prevParents = (meta.data.parents ?? []).join(",");

  const updated = await drive.files.update({
    fileId,
    addParents: newParentId,
    removeParents: prevParents || undefined,
    requestBody: { name: sanitizePathSegment(newName) },
    fields: "id,name,mimeType,size,webViewLink,thumbnailLink,parents",
    supportsAllDrives: true,
  });
  return updated.data;
}

export async function getFileMetadata(fileId: string): Promise<IncomingDriveFile> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,createdTime,webViewLink,thumbnailLink",
    supportsAllDrives: true,
  });
  const f = res.data;
  return {
    id: f.id!,
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    size: f.size ?? undefined,
    createdTime: f.createdTime,
    webViewLink: f.webViewLink,
    thumbnailLink: f.thumbnailLink,
  };
}