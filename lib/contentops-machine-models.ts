import { prisma } from "@/lib/prisma";
import { DEFAULT_MACHINE_MODELS, normalizeContentOpsMachineFamily } from "@/lib/contentops-constants";

export async function ensureDefaultMachineModelsSeeded(): Promise<void> {
  try {
    for (const [familyKey, models] of Object.entries(DEFAULT_MACHINE_MODELS)) {
      const canonicalFamily = normalizeContentOpsMachineFamily(familyKey);
      if (!canonicalFamily) continue;

      const existingRows = await prisma.machineModelOption.findMany({
        where: { family: canonicalFamily },
        select: { model: true },
      });
      const existingModels = new Set(existingRows.map((r) => r.model));

      const missing: { family: string; model: string; isActive: boolean }[] = [];
      for (const model of models) {
        if (existingModels.has(model)) continue;
        missing.push({ family: canonicalFamily, model, isActive: true });
      }

      if (missing.length === 0) continue;

      await prisma.machineModelOption.createMany({
        data: missing,
        skipDuplicates: true,
      });
    }
  } catch (e) {
    console.error("[contentops] ensureDefaultMachineModelsSeeded failed:", e);
  }
}
