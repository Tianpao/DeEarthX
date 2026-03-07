import { FileExtractor } from "./FileExtractor.js";
import { FileOperator } from "./FileOperator.js";
import { HashFilterStrategy } from "./strategies/HashFilterStrategy.js";
import { MixinFilterStrategy } from "./strategies/MixinFilterStrategy.js";
import { DexpubFilterStrategy } from "./strategies/DexpubFilterStrategy.js";
import { ModrinthFilterStrategy } from "./strategies/ModrinthFilterStrategy.js";
import { IFilterConfig } from "./types.js";
import { logger } from "../utils/logger.js";
import { MessageWS } from "../utils/ws.js";
import path from "node:path";

/**
 * 模组筛选服务 - 协调各个组件完成模组筛选
 */
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

  /**
   * 执行模组筛选主流程
   */
  async filter(): Promise<void> {
    logger.info("开始模组筛选流程");
    const startTime = Date.now();

    try {
      // 获取所有模组文件信息
      const files = await this.extractor.extractFilesInfo();

      if (this.messageWS) {
        this.messageWS.filterModsStart(files.length);
      }

      // 识别客户端模组
      const clientMods = await this.identifyClientSideMods(files);

      // 移动客户端模组
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

  /**
   * 识别客户端模组
   * 优先级: Galaxy Square (dexpub) → Modrinth API → Mixin → Hash
   */
  private async identifyClientSideMods(files: Array<{ filename: string; hash: string; mixins: any[]; infos: any[] }>): Promise<string[]> {
    const clientMods: string[] = [];
    const processedFiles = new Set<string>(); // 记录已处理的文件，避免重复筛选

    // 优先级1: Galaxy Square (dexpub) 检查
    if (this.config.dexpub) {
      logger.info("开始 Galaxy Square (dexpub) 检查客户端模组");
      const dexpubStrategy = new DexpubFilterStrategy();
      const dexpubMods = await dexpubStrategy.filter(files);
      const serverModsListSet = new Set(await dexpubStrategy.getServerMods(files));

      // 记录已处理的文件
      dexpubMods.forEach(mod => processedFiles.add(mod));
      serverModsListSet.forEach(mod => processedFiles.add(mod));

      clientMods.push(...dexpubMods);

      // 发送进度
      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Galaxy Square (dexpub) 检查");
      }
    }

    // 优先级2: Modrinth API 检查（只处理未标记为服务端且未被识别为客户端的文件）
    if (this.config.modrinth) {
      logger.info("开始 Modrinth API 检查客户端模组");

      // 获取已识别为服务端的文件（如果dexpub已运行）
      let serverModsSet = new Set<string>();
      if (this.config.dexpub) {
        const dexpubStrategy = new DexpubFilterStrategy();
        serverModsSet = new Set(await dexpubStrategy.getServerMods(files));
      }

      // 过滤出未处理的文件
      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));

      const modrinthMods = await new ModrinthFilterStrategy().filter(unprocessedFiles);

      // 记录已处理的文件
      modrinthMods.forEach(mod => processedFiles.add(mod));

      clientMods.push(...modrinthMods);

      // 发送进度
      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Modrinth API 检查");
      }
    }

    // 优先级3: Mixin 检查（只处理未被识别的文件）
    if (this.config.mixins) {
      logger.info("开始 Mixin 检查客户端模组");

      // 过滤出未处理的文件
      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));

      const mixinMods = await new MixinFilterStrategy().filter(unprocessedFiles);

      // 记录已处理的文件
      mixinMods.forEach(mod => processedFiles.add(mod));

      clientMods.push(...mixinMods);

      // 发送进度
      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Mixin 检查");
      }
    }

    // 优先级4: Hash 检查（只处理未被识别的文件）
    if (this.config.hashes) {
      logger.info("开始 Hash 检查客户端模组");

      // 过滤出未处理的文件
      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));

      const hashMods = await new HashFilterStrategy().filter(unprocessedFiles);

      clientMods.push(...hashMods);

      // 发送进度
      if (this.messageWS) {
        this.messageWS.filterModsProgress(processedFiles.size, files.length, "Hash 检查");
      }
    }

    // 去重
    const uniqueMods = [...new Set(clientMods)];
    logger.info("识别到客户端模组", { 数量: uniqueMods.length, 模组: uniqueMods });

    // 打印第一个模组的路径用于调试
    if (uniqueMods.length > 0) {
      logger.debug("第一个模组路径", { 原始路径: uniqueMods[0], 绝对路径: path.resolve(uniqueMods[0]), cwd: process.cwd() });
    }

    return uniqueMods;
  }
}
