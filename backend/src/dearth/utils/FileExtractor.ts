import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import murmurhash from "murmurhash";
import { JarParser } from "../../utils/jar-parser.js";
import { logger } from "../../utils/logger.js";
import { IFileInfo } from "../types.js";

export class FileExtractor {
  private readonly modsPath: string;

  constructor(modsPath: string) {
    this.modsPath = path.isAbsolute(modsPath) ? modsPath : path.resolve(modsPath);
  }

  async extractFilesInfo(): Promise<IFileInfo[]> {
    const jarFiles = await this.getJarFiles();
    const files: IFileInfo[] = [];

    logger.info("获取文件信息", { 文件数量: jarFiles.length });

    for (const jarFilename of jarFiles) {
      const fullPath = path.join(this.modsPath, jarFilename);

      try {
        const fileData = await fs.promises.readFile(fullPath);
        const mixins = await JarParser.extractMixins(fileData);
        const infos = await JarParser.extractModInfo(fileData);
        const murmur2 = this.computeMurmurHash2(fileData);

        files.push({
          filename: fullPath,
          hash: crypto.createHash('sha1').update(fileData).digest('hex'),
          murmur2,
          mixins,
          infos,
        });

        logger.debug("文件已处理", { 文件名: fullPath, 绝对路径: path.resolve(fullPath), Mixin数量: mixins.length });
      } catch (error: any) {
        logger.error("处理文件时出错", { 文件名: fullPath, 错误: error.message });
      }
    }

    logger.debug("文件信息收集完成", { 已处理文件: files.length });
    return files;
  }

  private async getJarFiles(): Promise<string[]> {
    try {
      await fs.promises.access(this.modsPath);
    } catch {
      await fs.promises.mkdir(this.modsPath, { recursive: true });
    }
    const entries = await fs.promises.readdir(this.modsPath);
    return entries.filter(f => f.endsWith(".jar"));
  }

  private computeMurmurHash2(buffer: Buffer): number {
    const exclude = new Set([0x09, 0x0A, 0x0D, 0x20]);
    const filtered = Buffer.allocUnsafe(buffer.length);
    let writeIndex = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (!exclude.has(buffer[i])) {
        filtered[writeIndex++] = buffer[i];
      }
    }
    return (murmurhash.v2(filtered.subarray(0, writeIndex), 1) as number) >>> 0;
  }
}
