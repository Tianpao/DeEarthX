import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger.js";

export class FileOperator {
  private readonly movePath: string;

  constructor(movePath: string) {
    this.movePath = movePath;
  }

  async moveClientSideMods(clientMods: string[]): Promise<{ success: number; error: number; skipped: number }> {
    if (!clientMods.length) {
      logger.info("No client-side mods to move");
      return { success: 0, error: 0, skipped: 0 };
    }

    const absoluteMovePath = path.isAbsolute(this.movePath) ? this.movePath : path.resolve(this.movePath);
    logger.debug("Target directory", { path: absoluteMovePath, exists: fsSync.existsSync(absoluteMovePath) });

    if (!fsSync.existsSync(absoluteMovePath)) {
      logger.debug("Creating target directory", { path: absoluteMovePath });
      await fs.mkdir(absoluteMovePath, { recursive: true });
    }

    let successCount = 0, errorCount = 0, skippedCount = 0;

    for (const sourcePath of clientMods) {
      try {
        const absoluteSourcePath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(sourcePath);

        logger.debug("Checking file", { originalPath: sourcePath, resolvedPath: absoluteSourcePath, cwd: process.cwd() });

        try {
          await fs.access(absoluteSourcePath);
        } catch (accessError) {
          logger.warn("File does not exist, skipping", { path: absoluteSourcePath, error: (accessError as Error).message });
          skippedCount++;
          continue;
        }

        const filename = path.basename(absoluteSourcePath);
        const targetPath = path.join(absoluteMovePath, filename);

        logger.info("Moving file", { source: absoluteSourcePath, target: targetPath, filename: filename });

        await fs.copyFile(absoluteSourcePath, targetPath);
        await fs.unlink(absoluteSourcePath);

        successCount++;
      } catch (error: any) {
        logger.error("Failed to move file", { source: sourcePath, error: error.message, code: error.code });
        errorCount++;
      }
    }

    logger.info("File movement completed", { total: clientMods.length, success: successCount, error: errorCount, skipped: skippedCount });
    return { success: successCount, error: errorCount, skipped: skippedCount };
  }
}
