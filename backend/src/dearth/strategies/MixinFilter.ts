import { logger } from "../../utils/logger.js";
import { IFilterStrategy, IFileInfo } from "../types.js";

export class MixinFilter implements IFilterStrategy {
  name = "MixinFilter";

  async filter(files: IFileInfo[]): Promise<string[]> {
    const clientMods: string[] = [];

    for (const file of files) {
      for (const mixin of file.mixins) {
        try {
          const config = JSON.parse(mixin.data);
          if (!config.mixins?.length && config.client?.length > 0 && !file.filename.includes("lib")) {
            clientMods.push(file.filename);
            break;
          }
        } catch (error: any) {
          logger.warn("Failed to parse mixin config", { filename: file.filename, mixin: mixin.name, error: error.message });
        }
      }
    }

    logger.debug("Mixins check completed", { count: clientMods.length });
    return [...new Set(clientMods)];
  }
}
