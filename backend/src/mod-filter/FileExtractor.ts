import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { JarParser } from "../utils/jar-parser.js";
import { logger } from "../utils/logger.js";
import { IFileInfo } from "./types.js";

export class FileExtractor {
  private readonly modsPath: string;

  constructor(modsPath: string) {
    this.modsPath = path.isAbsolute(modsPath) ? modsPath : path.resolve(modsPath);
  }

  async extractFilesInfo(): Promise<IFileInfo[]> {
    const jarFiles = this.getJarFiles();
    const files: IFileInfo[] = [];
    
    logger.info("获取文件信息", { 文件数量: jarFiles.length });

    for (const jarFilename of jarFiles) {
      const fullPath = path.join(this.modsPath, jarFilename);

      try {
        let fileData: Buffer | null = null;
        try {
          fileData = fs.readFileSync(fullPath);
          const mixins = await JarParser.extractMixins(fileData);
          const infos = await JarParser.extractModInfo(fileData);

          files.push({
            filename: fullPath,
            hash: crypto.createHash('sha1').update(fileData).digest('hex'),
            mixins,
            infos,
          });

          logger.debug("文件已处理", { 文件名: fullPath, 绝对路径: path.resolve(fullPath), Mixin数量: mixins.length });
        } finally {
          fileData = null;
        }
      } catch (error: any) {
        logger.error("处理文件时出错", { 文件名: fullPath, 错误: error.message });
      }
    }

    logger.debug("文件信息收集完成", { 已处理文件: files.length });
    return files;
  }

  private getJarFiles(): string[] {
    if (!fs.existsSync(this.modsPath)) {
      fs.mkdirSync(this.modsPath, { recursive: true });
    }
    return fs.readdirSync(this.modsPath).filter(f => f.endsWith(".jar"));
  }
}
