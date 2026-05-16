import { FileExtractor } from "./utils/FileExtractor.js";
import { FileOperator } from "./utils/FileOperator.js";
import { runFilterStrategies } from "./utils/StrategyRunner.js";
import { IFilterConfig } from "./types.js";
import { logger } from "../utils/logger.js";
import { MessageWS } from "../utils/socketio.js";

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
    return runFilterStrategies(files, this.config, this.messageWS);
  }
}
