import { logger } from "../../utils/logger.js";
import { IFilterStrategy, IFileInfo } from "../types.js";

export class MixinFilter implements IFilterStrategy {
  name = "MixinFilter";

  async filter(files: IFileInfo[]): Promise<string[]> {
    const clientMods: string[] = [];

    for (const file of files) {
      if (file.filename.includes("lib")) {
        continue;
      }

      let hasServerMixin = false;
      let hasClientMixin = false;

      for (const mixin of file.mixins) {
        try {
          const config = JSON.parse(mixin.data);
          if (config.mixins?.length || config.server?.length) {
            hasServerMixin = true;
          }
          if (config.client?.length) {
            hasClientMixin = true;
          }
        } catch (error: any) {
          logger.warn("Failed to parse mixin config", { filename: file.filename, mixin: mixin.name, error: error.message });
        }
      }

      if (hasClientMixin && !hasServerMixin) {
        clientMods.push(file.filename);
      }
    }

    logger.debug("Mixins check completed", { count: clientMods.length });
    return [...new Set(clientMods)];
  }
}
