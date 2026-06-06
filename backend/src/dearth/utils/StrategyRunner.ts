import { HashFilter } from "../strategies/HashFilter.js";
import { MixinFilter } from "../strategies/MixinFilter.js";
import { DexpubFilter } from "../strategies/DexpubFilter.js";
import { ModrinthFilter } from "../strategies/ModrinthFilter.js";
import { McmodFilter } from "../strategies/McmodFilter.js";
import { IFilterConfig, IFileInfo } from "../types.js";
import { logger } from "../../utils/logger.js";
import type { MessageWS } from "../../utils/socketio.js";

export async function runFilterStrategies(
  files: IFileInfo[],
  config: IFilterConfig,
  messageWS?: MessageWS
): Promise<string[]> {
  const clientMods: string[] = [];
  // Galaxy Square 判定过的文件（客户端+服务端），后续策略不可覆盖
  const gsDecidedFiles = new Set<string>();
  // 被高优先级策略检测出的客户端模组，Mixin 不可覆盖
  const skipMixinFiles = new Set<string>();

  // 第一优先级：Galaxy Square (Dexpub) — 最高权威，说什么就是什么
  if (config.dexpub) {
    logger.info("开始 Galaxy Square (dexpub) 检查客户端模组");
    const dexpubStrategy = new DexpubFilter();
    const dexpubMods = await dexpubStrategy.filter(files);
    const serverModsListSet = new Set(await dexpubStrategy.getServerMods(files));

    dexpubMods.forEach(mod => {
      gsDecidedFiles.add(mod);
      skipMixinFiles.add(mod);
    });
    serverModsListSet.forEach(mod => {
      gsDecidedFiles.add(mod);
      skipMixinFiles.add(mod);
    });
    clientMods.push(...dexpubMods);

    if (messageWS) {
      messageWS.filterModsProgress(gsDecidedFiles.size, files.length, "Galaxy Square (dexpub) 检查");
    }
  }

  // 第二优先级：Hash 和 Modrinth API（同级，并行执行）
  // GS 已判定的文件不传给它们，它们无法覆盖 GS 的判定
  const hashPromise = config.hashes ? (async () => {
    logger.info("开始 Hash 检查客户端模组");
    const unprocessedFiles = files.filter(f => !gsDecidedFiles.has(f.filename));
    const hashMods = await new HashFilter().filter(unprocessedFiles);
    return { mods: hashMods, strategy: "hash" as const };
  })() : Promise.resolve({ mods: [] as string[], strategy: "hash" as const });

  const modrinthPromise = config.modrinth ? (async () => {
    logger.info("开始 Modrinth API 检查客户端模组");
    const unprocessedFiles = files.filter(f => !gsDecidedFiles.has(f.filename));
    const modrinthMods = await new ModrinthFilter().filter(unprocessedFiles);
    return { mods: modrinthMods, strategy: "modrinth" as const };
  })() : Promise.resolve({ mods: [] as string[], strategy: "modrinth" as const });

  const [hashResult, modrinthResult] = await Promise.all([hashPromise, modrinthPromise]);

  // 合并 Hash 和 Modrinth 的结果
  const hashAndModrinthMods = [...new Set([...hashResult.mods, ...modrinthResult.mods])];
  hashAndModrinthMods.forEach(mod => {
    skipMixinFiles.add(mod);
  });
  clientMods.push(...hashAndModrinthMods);

  if (messageWS && (config.hashes || config.modrinth)) {
    messageWS.filterModsProgress(gsDecidedFiles.size + hashAndModrinthMods.length, files.length, "Hash/Modrinth API 检查");
  }

  // 第三优先级：Mcmod API（在 Hash/Modrinth 之后，Mixin 之前）
  if (config.mcmod) {
    logger.info("开始 Mcmod API 检查客户端模组");
    const unprocessedFiles = files.filter(f => !skipMixinFiles.has(f.filename));
    const mcmodMods = await new McmodFilter().filter(unprocessedFiles);
    mcmodMods.forEach(mod => {
      skipMixinFiles.add(mod);
    });
    clientMods.push(...mcmodMods);

    if (messageWS) {
      messageWS.filterModsProgress(skipMixinFiles.size, files.length, "Mcmod API 检查");
    }
  }

  // 第四优先级：Mixin（最低优先级）
  // GS 判定过的文件和 Hash/Modrinth 检测出的客户端模组，Mixin 都不可覆盖
  if (config.mixins) {
    logger.info("开始 Mixin 检查客户端模组");

    const unprocessedFiles = files.filter(f => !skipMixinFiles.has(f.filename));
    const mixinMods = await new MixinFilter().filter(unprocessedFiles);

    clientMods.push(...mixinMods);

    if (messageWS) {
      messageWS.filterModsProgress(skipMixinFiles.size + mixinMods.length, files.length, "Mixin 检查");
    }
  }

  const uniqueMods = [...new Set(clientMods)];
  logger.info("识别到客户端模组", { 数量: uniqueMods.length, 模组: uniqueMods });

  return uniqueMods;
}
