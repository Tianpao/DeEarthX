import got from "got";
import { getMirrorUrls, MirrorUrls } from "../../utils/download.js";
import { logger } from "../../utils/logger.js";
import { IFilterStrategy, IFileInfo, IHashResponse, IProjectInfo } from "../types.js";

export class HashFilter implements IFilterStrategy {
  name = "HashFilter";
  private urls: MirrorUrls;

  constructor() {
    this.urls = getMirrorUrls();
  }

  async filter(files: IFileInfo[]): Promise<string[]> {
    const hashToFilename = new Map<string, string>();
    const hashes = files.map(file => {
      hashToFilename.set(file.hash, file.filename);
      return file.hash;
    });

    logger.debug("Checking mod hashes with Modrinth API", { fileCount: files.length });

    try {
      const fileInfoResponse = await got.post(`${this.urls.modrinth_url}/v2/version_files`, {
        headers: { "User-Agent": "DeEarth", "Content-Type": "application/json" },
        json: { hashes, algorithm: "sha1" }
      }).json<IHashResponse>();

      const projectIdToFilename = new Map<string, string>();
      const projectIds = Object.entries(fileInfoResponse)
        .map(([hash, info]) => {
          const filename = hashToFilename.get(hash);
          if (filename) projectIdToFilename.set(info.project_id, filename);
          return info.project_id;
        });

      const projectsResponse = await got.get(`${this.urls.modrinth_url}/v2/projects?ids=${JSON.stringify(projectIds)}`, {
        headers: { "User-Agent": "DeEarth" }
      }).json<IProjectInfo[]>();

      const clientMods = projectsResponse
        .filter(p => p.client_side === "required" && p.server_side === "unsupported")
        .map(p => {
          const filename = projectIdToFilename.get(p.id);
          if (filename) {
            logger.debug("Modrinth Hashes 标记为客户端模组", {
              filename,
              projectId: p.id,
              client_side: p.client_side,
              server_side: p.server_side
            });
          }
          return filename;
        })
        .filter(Boolean) as string[];

      logger.debug("Hash check completed", { count: clientMods.length });
      return clientMods;
    } catch (error: any) {
      logger.error("Hash check failed", error);
      return [];
    }
  }
}
