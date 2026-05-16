import { HashFilter } from "../strategies/HashFilter.js";
import { MixinFilter } from "../strategies/MixinFilter.js";
import { DexpubFilter } from "../strategies/DexpubFilter.js";
import { ModrinthFilter } from "../strategies/ModrinthFilter.js";
import { IFilterConfig, IFileInfo } from "../types.js";
import { logger } from "../../utils/logger.js";
import type { MessageWS } from "../../utils/socketio.js";

export async function runFilterStrategies(
  files: IFileInfo[],
  config: IFilterConfig,
  messageWS?: MessageWS
): Promise<string[]> {
  const clientMods: string[] = [];
  const processedFiles = new Set<string>();

  if (config.dexpub) {
    logger.info("开始 Galaxy Square (dexpub) 检查客户端模组");
    const dexpubStrategy = new DexpubFilter();
    const dexpubMods = await dexpubStrategy.filter(files);
    const serverModsListSet = new Set(await dexpubStrategy.getServerMods(files));

    dexpubMods.forEach(mod => processedFiles.add(mod));
    serverModsListSet.forEach(mod => processedFiles.add(mod));
    clientMods.push(...dexpubMods);

    if (messageWS) {
      messageWS.filterModsProgress(processedFiles.size, files.length, "Galaxy Square (dexpub) 检查");
    }
  }

  if (config.modrinth) {
    logger.info("开始 Modrinth API 检查客户端模组");

    const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
    const modrinthMods = await new ModrinthFilter().filter(unprocessedFiles);

    modrinthMods.forEach(mod => processedFiles.add(mod));
    clientMods.push(...modrinthMods);

    if (messageWS) {
      messageWS.filterModsProgress(processedFiles.size, files.length, "Modrinth API 检查");
    }
  }

  if (config.mixins) {
    logger.info("开始 Mixin 检查客户端模组");

    const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
    const mixinMods = await new MixinFilter().filter(unprocessedFiles);

    mixinMods.forEach(mod => processedFiles.add(mod));
    clientMods.push(...mixinMods);

    if (messageWS) {
      messageWS.filterModsProgress(processedFiles.size, files.length, "Mixin 检查");
    }
  }

  if (config.hashes) {
    logger.info("开始 Hash 检查客户端模组");

    const unprocessedFiles = files.filter(f => !processedFiles.has(f.filename));
    const hashMods = await new HashFilter().filter(unprocessedFiles);

    clientMods.push(...hashMods);

    if (messageWS) {
      messageWS.filterModsProgress(processedFiles.size, files.length, "Hash 检查");
    }
  }

  const uniqueMods = [...new Set(clientMods)];
  logger.info("识别到客户端模组", { 数量: uniqueMods.length, 模组: uniqueMods });

  return uniqueMods;
}
