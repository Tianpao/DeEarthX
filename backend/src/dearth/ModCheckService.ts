import { FileExtractor } from "./utils/FileExtractor.js";
import { HashFilter } from "./strategies/HashFilter.js";
import { MixinFilter } from "./strategies/MixinFilter.js";
import { DexpubFilter } from "./strategies/DexpubFilter.js";
import { ModrinthFilter } from "./strategies/ModrinthFilter.js";
import { IModCheckResult, IModCheckConfig, IFileInfo, ModSide } from "./types.js";
import { JarParser } from "../utils/jar-parser.js";
import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
import crypto from "node:crypto";

const DEFAULT_CONFIG: IModCheckConfig = {
  enableDexpub: true,
  enableModrinth: true,
  enableMixin: true,
  enableHash: true,
  timeout: 30000,
};

export class ModCheckService {
  private readonly extractor: FileExtractor;
  private readonly config: IModCheckConfig;

  constructor(modsDir: string, config?: Partial<IModCheckConfig>) {
    this.extractor = new FileExtractor(modsDir);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkMods(): Promise<IModCheckResult[]> {
    logger.info("开始模组检查流程");
    const files = await this.extractor.extractFilesInfo();
    const results: IModCheckResult[] = [];

    for (const file of files) {
      const result = await this.checkSingleFile(file);
      results.push(result);
    }

    logger.info("模组检查流程完成", { 总模组数: results.length });
    return results;
  }

  async checkModsWithBundle(bundleName: string): Promise<IModCheckResult[]> {
    logger.info("开始模组检查流程（带整合包）", { bundleName });
    const files = await this.extractor.extractFilesInfo();
    const results: IModCheckResult[] = [];

    const clientMods = await this.identifyClientSideMods(files);
    
    for (const file of files) {
      const filename = file.filename;
      const isClient = clientMods.includes(filename);
      
      results.push({
        filename: path.basename(filename),
        filePath: filename,
        clientSide: isClient ? 'required' : 'unknown',
        serverSide: isClient ? 'unsupported' : 'unknown',
        source: isClient ? 'Multiple' : 'none',
        checked: isClient,
        allResults: isClient ? [{
          source: 'Multiple',
          clientSide: 'required',
          serverSide: 'unsupported',
          checked: true
        }] : []
      });
    }

    if (clientMods.length > 0) {
      await this.moveClientMods(clientMods, bundleName);
      logger.info(`已移动 ${clientMods.length} 个客户端模组到 .rubbish/${bundleName}`);
    }

    logger.info("模组检查流程完成", { 总模组数: results.length, 客户端模组数: clientMods.length });
    return results;
  }

  private async identifyClientSideMods(files: IFileInfo[]): Promise<string[]> {
    const clientMods: string[] = [];
    const processedFiles = new Set<string>();

    if (this.config.enableDexpub) {
      logger.info("开始 Galaxy Square (dexpub) 检查客户端模组");
      const dexpubStrategy = new DexpubFilter();
      const dexpubMods = await dexpubStrategy.filter(files);
      const serverModsListSet = new Set(await dexpubStrategy.getServerMods(files));

      dexpubMods.forEach(mod => processedFiles.add(mod));
      serverModsListSet.forEach(mod => processedFiles.add(mod));
      clientMods.push(...dexpubMods);
    }

    if (this.config.enableModrinth) {
      logger.info("开始 Modrinth API 检查客户端模组");

      let serverModsSet = new Set<string>();
      if (this.config.enableDexpub) {
        const dexpubStrategy = new DexpubFilter();
        serverModsSet = new Set(await dexpubStrategy.getServerMods(files));
      }

      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
      const modrinthMods = await new ModrinthFilter().filter(unprocessedFiles);

      modrinthMods.forEach(mod => processedFiles.add(mod));
      clientMods.push(...modrinthMods);
    }

    if (this.config.enableMixin) {
      logger.info("开始 Mixin 检查客户端模组");

      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
      const mixinMods = await new MixinFilter().filter(unprocessedFiles);

      mixinMods.forEach(mod => processedFiles.add(mod));
      clientMods.push(...mixinMods);
    }

    if (this.config.enableHash) {
      logger.info("开始 Hash 检查客户端模组");

      const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
      const hashMods = await new HashFilter().filter(unprocessedFiles);

      clientMods.push(...hashMods);
    }

    const uniqueMods = [...new Set(clientMods)];
    logger.info("识别到客户端模组", { 数量: uniqueMods.length });

    return uniqueMods;
  }

  private async moveClientMods(clientModFilePaths: string[], bundleName: string): Promise<void> {
    const rubbishDir = path.join('.rubbish', bundleName);
    
    try {
      await fs.promises.mkdir(rubbishDir, { recursive: true });
      logger.info(`创建目录: ${rubbishDir}`);
    } catch (error: any) {
      logger.error(`创建目录失败: ${rubbishDir}`, error);
      throw error;
    }

    for (const filePath of clientModFilePaths) {
      const filename = path.basename(filePath);
      const destPath = path.join(rubbishDir, filename);

      try {
        await fs.promises.rename(filePath, destPath);
        logger.debug(`移动模组: ${filename} -> ${destPath}`);
      } catch (error: any) {
        logger.error(`移动模组失败: ${filename}`, error);
      }
    }
  }

  async checkUploadedFiles(uploadedFiles: Array<{ originalname: string; buffer: Buffer }>): Promise<IModCheckResult[]> {
    logger.info("开始检查上传文件", { 文件数量: uploadedFiles.length });
    const results: IModCheckResult[] = [];

    for (const uploadedFile of uploadedFiles) {
      try {
        const fileData = uploadedFile.buffer;
        const mixins = await JarParser.extractMixins(fileData);
        const infos = await JarParser.extractModInfo(fileData);

        const fileInfo: IFileInfo = {
          filename: uploadedFile.originalname,
          hash: crypto.createHash('sha1').update(fileData).digest('hex'),
          mixins,
          infos,
          fileData,
        };

        const result = await this.checkSingleFile(fileInfo);
        results.push(result);
      } catch (error: any) {
        logger.error("处理上传文件时出错", { 文件名: uploadedFile.originalname, 错误: error.message });
        results.push({
          filename: uploadedFile.originalname,
          filePath: uploadedFile.originalname,
          clientSide: "unknown",
          serverSide: "unknown",
          source: "none",
          checked: false,
          errors: [error.message],
          allResults: [],
        });
      }
    }

    logger.info("上传文件模组检查完成", { 总模组数: results.length });
    return results;
  }

  async checkSingleMod(filePath: string): Promise<IModCheckResult> {
    const filename = path.basename(filePath);
    const hash = await this.calculateHash(filePath);
    const extractor = new FileExtractor(path.dirname(filePath));
    const files = await extractor.extractFilesInfo();
    const fileInfo = files.find(f => f.filename === filename);

    if (!fileInfo) {
      return {
        filename,
        filePath,
        clientSide: "unknown",
        serverSide: "unknown",
        source: "none",
        checked: false,
        errors: ["文件未找到或无法提取"],
        allResults: [],
      };
    }

    return this.checkSingleFile(fileInfo);
  }

  private async checkSingleFile(file: IFileInfo): Promise<IModCheckResult> {
    const result: IModCheckResult = {
      filename: file.filename,
      filePath: file.filename,
      clientSide: "unknown",
      serverSide: "unknown",
      source: "none",
      checked: false,
      errors: [],
      allResults: [],
    };

    const allResults = await this.collectAllResultsParallel(file);
    result.allResults = allResults;

    const bestResult = this.mergeResults(allResults);
    
    result.clientSide = bestResult.clientSide;
    result.serverSide = bestResult.serverSide;
    result.source = bestResult.source;
    result.checked = bestResult.checked;
    result.errors = bestResult.errors;

    const modInfo = await this.extractModInfoDetails(file);
    if (modInfo) {
      result.modId = modInfo.id;
      result.iconUrl = modInfo.iconUrl;
      result.description = modInfo.description;
      result.author = modInfo.author;
    }

    return result;
  }

  private async collectAllResultsParallel(file: IFileInfo): Promise<Array<{
    clientSide: ModSide;
    serverSide: ModSide;
    source: string;
    checked: boolean;
    error?: string;
  }>> {
    const checkPromises: Promise<{
      clientSide: ModSide;
      serverSide: ModSide;
      source: string;
      checked: boolean;
      error?: string;
    }>[] = [];

    if (this.config.enableDexpub) {
      checkPromises.push(this.runCheckWithTimeout(this.checkDexpub, file, "Dexpub"));
    }

    if (this.config.enableModrinth) {
      checkPromises.push(this.runCheckWithTimeout(this.checkModrinth, file, "Modrinth"));
    }

    if (this.config.enableMixin) {
      checkPromises.push(this.runCheckWithTimeout(this.checkMixin, file, "Mixin"));
    }

    if (this.config.enableHash) {
      checkPromises.push(this.runCheckWithTimeout(this.checkHash, file, "Hash"));
    }

    return Promise.all(checkPromises);
  }

  private async runCheckWithTimeout(
    checkFn: (file: IFileInfo) => Promise<{ clientSide: ModSide; serverSide: ModSide } | null>,
    file: IFileInfo,
    source: string
  ): Promise<{
    clientSide: ModSide;
    serverSide: ModSide;
    source: string;
    checked: boolean;
    error?: string;
  }> {
    return this.runWithTimeout(
      checkFn(file),
      `${source} 检查超时: ${file.filename}`
    ).then(result => {
      if (result) {
        return {
          clientSide: result.clientSide,
          serverSide: result.serverSide,
          source,
          checked: true,
        };
      }
      return {
        clientSide: "unknown" as ModSide,
        serverSide: "unknown" as ModSide,
        source,
        checked: false,
      };
    }).catch((error: any) => {
      logger.warn(`${file.filename} 的 ${source} 检查失败`, { 错误: error.message });
      return {
        clientSide: "unknown" as ModSide,
        serverSide: "unknown" as ModSide,
        source,
        checked: false,
        error: error.message,
      };
    });
  }

  private mergeResults(results: Array<{
    clientSide: ModSide;
    serverSide: ModSide;
    source: string;
    checked: boolean;
    error?: string;
  }>): {
    clientSide: ModSide;
    serverSide: ModSide;
    source: string;
    checked: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const successfulResults = results.filter(r => r.checked);

    for (const r of results) {
      if (r.error) {
        errors.push(`${r.source}: ${r.error}`);
      }
    }

    if (successfulResults.length === 0) {
      return {
        clientSide: "unknown",
        serverSide: "unknown",
        source: "none",
        checked: false,
        errors,
      };
    }

    const priority: { [key: string]: number } = {
      "Dexpub": 1,
      "Modrinth": 2,
      "Mixin": 3,
      "Hash": 4,
    };

    successfulResults.sort((a, b) => priority[a.source] - priority[b.source]);
    const best = successfulResults[0];

    return {
      clientSide: best.clientSide,
      serverSide: best.serverSide,
      source: best.source,
      checked: true,
      errors,
    };
  }

  private async checkDexpub(file: IFileInfo): Promise<{ clientSide: ModSide; serverSide: ModSide } | null> {
    const strategy = new DexpubFilter();
    const files = [file];
    
    const clientMods = await strategy.filter(files);
    const serverMods = await strategy.getServerMods(files);
    const filename = path.basename(file.filename);
    
    if (clientMods.some(f => path.basename(f) === filename)) {
      return { clientSide: "required", serverSide: "unsupported" };
    } else if (serverMods.some(f => path.basename(f) === filename)) {
      return { clientSide: "unsupported", serverSide: "required" };
    }

    return null;
  }

  private async checkModrinth(file: IFileInfo): Promise<{ clientSide: ModSide; serverSide: ModSide } | null> {
    const strategy = new ModrinthFilter();
    const files = [file];
    const clientMods = await strategy.filter(files);
    const filename = path.basename(file.filename);
    
    if (clientMods.some(f => path.basename(f) === filename)) {
      return { clientSide: "required", serverSide: "unsupported" };
    }

    for (const info of file.infos) {
      if (info.name === "modrinth.index.json" || info.name === "modrinth.json") {
        try {
          const data = JSON.parse(info.data);
          const clientSide = this.mapClientSide(data.client_side);
          const serverSide = this.mapServerSide(data.server_side);
          return { clientSide, serverSide };
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private async checkMixin(file: IFileInfo): Promise<{ clientSide: ModSide; serverSide: ModSide } | null> {
    for (const mixin of file.mixins) {
      try {
        const config = JSON.parse(mixin.data);
        if (!config.mixins?.length && config.client?.length > 0 && !file.filename.includes("lib")) {
          return { clientSide: "required", serverSide: "unsupported" };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private async checkHash(file: IFileInfo): Promise<{ clientSide: ModSide; serverSide: ModSide } | null> {
    const strategy = new HashFilter();
    const files = [file];
    const clientMods = await strategy.filter(files);
    const filename = path.basename(file.filename);
    
    if (clientMods.some(f => path.basename(f) === filename)) {
      return { clientSide: "required", serverSide: "unsupported" };
    }

    return null;
  }

  private mapClientSide(value: string | undefined): ModSide {
    if (value === "required") return "required";
    if (value === "optional") return "optional";
    if (value === "unsupported") return "unsupported";
    return "unknown";
  }

  private mapServerSide(value: string | undefined): ModSide {
    if (value === "required") return "required";
    if (value === "optional") return "optional";
    if (value === "unsupported") return "unsupported";
    return "unknown";
  }

  private async runWithTimeout<T>(promise: Promise<T>, timeoutMessage: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, this.config.timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  private async calculateHash(filePath: string): Promise<string> {
    const fileData = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(fileData).digest('hex');
  }

  private async extractModInfoDetails(file: IFileInfo): Promise<{
    id?: string;
    iconUrl?: string;
    description?: string;
    author?: string;
  } | null> {
    for (const info of file.infos) {
      try {
        if (info.name.endsWith("mods.toml") || info.name.endsWith("neoforge.mods.toml")) {
          const { default: toml } = await import("smol-toml");
          const data = toml.parse(info.data) as any;
          
          if (data.mods && Array.isArray(data.mods) && data.mods.length > 0) {
            const mod = data.mods[0] as any;
            let iconUrl: string | undefined;
            
            if (mod.logoFile) {
              iconUrl = await this.extractIconFile(file, mod.logoFile);
            }
            
            return {
              id: mod.modId || mod.modid,
              iconUrl,
              description: mod.description,
              author: mod.authors || mod.author,
            };
          }
        } else if (info.name.endsWith("fabric.mod.json")) {
          const data = JSON.parse(info.data);
          
          return {
            id: data.id,
            iconUrl: data.icon,
            description: data.description,
            author: data.authors?.join(", ") || data.author,
          };
        } else if (info.name === "modrinth.index.json" || info.name === "modrinth.json") {
          const data = JSON.parse(info.data);
          
          return {
            id: data.project_id || data.id,
            description: data.summary || data.description,
          };
        }
      } catch (error: any) {
        logger.debug(`解析 ${info.name} 失败:`, error.message);
        continue;
      }
    }

    return null;
  }

  private async extractIconFile(file: IFileInfo, iconPath: string): Promise<string | undefined> {
    try {
      let jarData: Buffer;
      
      if (file.fileData) {
        jarData = file.fileData;
      } else {
        jarData = fs.readFileSync(file.filename);
      }
      
      const { Azip } = await import("../utils/ziplib.js");
      const zipEntries = Azip(jarData);
      
      for (const entry of zipEntries) {
        if (entry.entryName === iconPath || entry.entryName.endsWith(iconPath)) {
          const data = await entry.getData();
          const ext = iconPath.split('.').pop()?.toLowerCase();
          const mimeType = ext === 'png' ? 'png' : 'jpeg';
          
          return `data:image/${mimeType};base64,${data.toString('base64')}`;
        }
      }
    } catch (error: any) {
      logger.debug(`提取图标文件 ${iconPath} 失败:`, error.message);
    }
    
    return undefined;
  }
}
