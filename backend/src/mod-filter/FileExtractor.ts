import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { Azip } from "../utils/ziplib.js";
import toml from "smol-toml";
import { logger } from "../utils/logger.js";
import { IFileInfo, IInfoFile, IMixinFile } from "./types.js";

/**
 * 文件提取器 - 负责从 JAR 文件中提取模组信息
 */
export class FileExtractor {
  private readonly modsPath: string;

  constructor(modsPath: string) {
    this.modsPath = path.isAbsolute(modsPath) ? modsPath : path.resolve(modsPath);
  }

  /**
   * 获取所有模组文件的信息
   */
  async extractFilesInfo(): Promise<IFileInfo[]> {
    const jarFiles = this.getJarFiles();
    const files: IFileInfo[] = [];
    
    logger.info("获取文件信息", { 文件数量: jarFiles.length });

    for (const jarFilename of jarFiles) {
      const fullPath = path.join(this.modsPath, jarFilename);

      try {
        // 使用try-finally确保文件数据正确处理
        let fileData: Buffer | null = null;
        try {
          fileData = fs.readFileSync(fullPath);
          const mixins = await this.extractMixins(fileData);
          const infos = await this.extractModInfo(fileData);

          files.push({
            filename: fullPath,
            hash: crypto.createHash('sha1').update(fileData).digest('hex'),
            mixins,
            infos,
          });

          logger.debug("文件已处理", { 文件名: fullPath, 绝对路径: path.resolve(fullPath), Mixin数量: mixins.length });
        } finally {
          // 释放内存中的文件数据
          fileData = null;
        }
      } catch (error: any) {
        logger.error("处理文件时出错", { 文件名: fullPath, 错误: error.message });
      }
    }

    logger.debug("文件信息收集完成", { 已处理文件: files.length });
    return files;
  }

  /**
   * 获取所有 JAR 文件
   */
  private getJarFiles(): string[] {
    if (!fs.existsSync(this.modsPath)) {
      fs.mkdirSync(this.modsPath, { recursive: true });
    }
    return fs.readdirSync(this.modsPath).filter(f => f.endsWith(".jar"));
  }

  /**
   * 从 JAR 文件中提取 Mod 信息
   */
  private async extractModInfo(jarData: Buffer): Promise<IInfoFile[]> {
    const infos: IInfoFile[] = [];
    const zipEntries = Azip(jarData);
    
    await Promise.all(zipEntries.map(async (entry) => {
      try {
        if (entry.entryName.endsWith("neoforge.mods.toml") || entry.entryName.endsWith("mods.toml")) {
          const data = await entry.getData();
          infos.push({ name: entry.entryName, data: JSON.stringify(toml.parse(data.toString())) });
        } else if (entry.entryName.endsWith("fabric.mod.json")) {
          const data = await entry.getData();
          infos.push({ name: entry.entryName, data: data.toString() });
        }
      } catch (error: any) {
        logger.error(`Error extracting ${entry.entryName}`, error);
      }
    }));

    return infos;
  }

  /**
   * 从 JAR 文件中提取 Mixin 配置
   */
  private async extractMixins(jarData: Buffer): Promise<IMixinFile[]> {
    const mixins: IMixinFile[] = [];
    const zipEntries = Azip(jarData);

    await Promise.all(zipEntries.map(async (entry) => {
      if (entry.entryName.endsWith(".mixins.json") && !entry.entryName.includes("/")) {
        try {
          const data = await entry.getData();
          mixins.push({ name: entry.entryName, data: data.toString() });
        } catch (error: any) {
          logger.error(`提取 ${entry.entryName} 时出错`, error);
        }
      }
    }));

    return mixins;
  }
}
