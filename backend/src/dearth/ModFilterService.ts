import { FileExtractor } from "./utils/FileExtractor.js";
import { FileOperator } from "./utils/FileOperator.js";
import { HashFilter } from "./strategies/HashFilter.js";
import { MixinFilter } from "./strategies/MixinFilter.js";
import { DexpubFilter } from "./strategies/DexpubFilter.js";
import { ModrinthFilter } from "./strategies/ModrinthFilter.js";
import { IFilterConfig } from "./types.js";
import { logger } from "../utils/logger.js";
import { MessageWS } from "../utils/ws.js";
import path from "node:path";

export class ModFilterService {
  private readonly extractor: FileExtractor;
  private readonly operator: FileOperator;
  private readonly config: IFilterConfig;
  private messageWS?: MessageWS;

  constructor(modsPath: string, movePath: string, config: IFilterConfig, messageWS?: MessageWS) {
    this.extractor = new FileExtractor(modsPath);
    this.operator = new FileOperator(movePath);
    this.config = config;
    this.messageWS = messageWS;
  }

  async filter(): Promise<void> {
    logger.info("开始模组筛选流程");
    const startTime = Date.now();

    try {
      const files = await this.extractor.extractFilesInfo();

      if (this.messageWS) {
        this.messageWS.filterModsStart(files.length);
      }

      const clientMods = await this.identifyClientSideMods(files);
      const result = await this.operator.moveClientSideMods(clientMods);

      const duration = Date.now() - startTime;

      if (this.messageWS) {
        this.messageWS.filterModsComplete(clientMods.length, result.success, duration);
      }

      logger.info("模组筛选流程完成", { 
        识别到的客户端模组: clientMods.length,
        成功移动: result.success,
        跳过: result.skipped,
        失败: result.error
      });
    } catch (error) {
      if (this.messageWS) {
        this.messageWS.filterModsError(error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }

  private async identifyClientSideMods(files: Array<{ filename: string; hash: string; mixins: any[]; infos: any[] }>): Promise<string[]> {
    const clientMods: string[] = [];
    const processedFiles = new Set<string>();

    if (this.config.dexpub) {
      logger.info("开始 Galaxy Square (dexpub) 检查客户端模组");
      const dexpubStrategy = new DexpubFilter();
      const dexpubMods = await dexpubStrategy.filter(files);
      const serverModsListSet = new Set(await dexpubStrategy.getServerMods(files));

      dexpubMods.forEach(mod => processedFiles.add(mod));
      serverModsListSet.forEach(mod => processedFiles.add(mod));
      clientMods.push(...dexpubMods);

      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Galaxy Square (dexpub) 检查");
      }
    }

    if (this.config.modrinth) {
      logger.info("开始 Modrinth API 检查客户端模组");

      let serverModsSet = new Set<string>();
      if (this.config.dexpub) {
        const dexpubStrategy = new DexpubFilter();
        serverModsSet = new Set(await dexpubStrategy.getServerMods(files));
      }

      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
      const modrinthMods = await new ModrinthFilter().filter(unprocessedFiles);

      modrinthMods.forEach(mod => processedFiles.add(mod));
      clientMods.push(...modrinthMods);

      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Modrinth API 检查");
      }
    }

    if (this.config.mixins) {
      logger.info("开始 Mixin 检查客户端模组");

      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
      const mixinMods = await new MixinFilter().filter(unprocessedFiles);

      mixinMods.forEach(mod => processedFiles.add(mod));
      clientMods.push(...mixinMods);

      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Mixin 检查");
      }
    }

    if (this.config.hashes) {
      logger.info("开始 Hash 检查客户端模组");

      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
      const hashMods = await new HashFilter().filter(unprocessedFiles);

      clientMods.push(...hashMods);

      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Hash 检查");
      }
    }

    const uniqueMods = [...new Set(clientMods)];
    logger.info("识别到客户端模组", { 数量: uniqueMods.length, 模组: uniqueMods });

    if (uniqueMods.length > 0) {
      logger.debug("第一个模组路径", { 原始路径: uniqueMods[0], 绝对路径: path.resolve(uniqueMods[0]), cwd: process.cwd() });
    }

    return uniqueMods;
  }
}
