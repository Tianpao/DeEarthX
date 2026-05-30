import { logger } from "../../utils/logger.js";
import { IFilterStrategy, IFileInfo } from "../types.js";

interface MixinConfig {
  required?: boolean;
  package?: string;
  mixins?: string[];
  client?: string[];
  server?: string[];
}

export class MixinFilter implements IFilterStrategy {
  name = "MixinFilter";

  async filter(files: IFileInfo[]): Promise<string[]> {
    const clientMods: string[] = [];

    for (const file of files) {
      if (file.filename.includes("lib")) {
        continue;
      }

      const mixinResult = this.analyzeMixins(file.mixins);

      if (mixinResult.isClientOnly) {
        clientMods.push(file.filename);
        logger.debug("Mixin 配置标记为客户端模组", {
          filename: file.filename,
          reason: mixinResult.reason
        });
      }
    }

    logger.debug("Mixins check completed", { count: clientMods.length });
    return [...new Set(clientMods)];
  }

  private analyzeMixins(mixins: { name: string; data: string }[]): { isClientOnly: boolean; reason: string } {
    let hasCommonMixin = false;
    let hasServerMixin = false;
    let hasClientMixin = false;

    for (const mixin of mixins) {
      try {
        const config: MixinConfig = JSON.parse(mixin.data);

        if (config.mixins && config.mixins.length > 0) {
          hasCommonMixin = true;
        }
        if (config.server && config.server.length > 0) {
          hasServerMixin = true;
        }
        if (config.client && config.client.length > 0) {
          hasClientMixin = true;
        }
      } catch (error: any) {
        logger.warn("Failed to parse mixin config", { mixin: mixin.name, error: error.message });
      }
    }

    // 判定逻辑：
    // 只有 client mixin（没有 common 和 server）→ 客户端模组
    // 有 server mixin → 服务端可用
    // 有 common + client 但没有 server → 不确定，交给其他策略判断
    if (hasClientMixin && !hasCommonMixin && !hasServerMixin) {
      return { isClientOnly: true, reason: "only has client mixins" };
    }

    return { isClientOnly: false, reason: "" };
  }
}
