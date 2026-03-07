import { IFilterStrategy, IFileInfo } from "../types.js";
import { logger } from "../../utils/logger.js";

interface IModrinthProject {
  client_side: string;
  server_side: string;
  project_type: string;
  categories: string[];
}

export class ModrinthFilter implements IFilterStrategy {
  name = "ModrinthFilter";
  private readonly API_BASE = "https://api.modrinth.com/v2";

  private extractProjectId(infos: { name: string; data: string }[]): string | null {
    for (const info of infos) {
      if (info.name === "modrinth.index.json" || info.name === "modrinth.json") {
        try {
          const data = JSON.parse(info.data);
          return data.project_id || null;
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private async fetchProjectInfo(projectIds: string[]): Promise<Map<string, IModrinthProject>> {
    const projectMap = new Map<string, IModrinthProject>();
    const batchSize = 50;

    for (let i = 0; i < projectIds.length; i += batchSize) {
      const batch = projectIds.slice(i, i + batchSize);
      const idsParam = batch.join(",");

      try {
        const response = await fetch(`${this.API_BASE}/projects?ids=${encodeURIComponent(idsParam)}`, {
          headers: {
            'User-Agent': 'DeEarthX-V3/1.0.0'
          }
        });

        if (response.ok) {
          const projects: Array<any> = await response.json();

          for (const project of projects) {
            if (project && project.id) {
              projectMap.set(project.id, {
                client_side: project.client_side,
                server_side: project.server_side,
                project_type: project.project_type,
                categories: project.categories || []
              });
            }
          }
        }
      } catch (error) {
        logger.error("获取 Modrinth 项目信息失败", { error, batchSize });
      }
    }

    return projectMap;
  }

  private isClientMod(project: IModrinthProject): boolean {
    const clientSide = project.client_side;
    const serverSide = project.server_side;

    return (
      clientSide === "required" ||
      (clientSide === "optional" && serverSide === "unsupported")
    );
  }

  async filter(files: IFileInfo[]): Promise<string[]> {
    const clientMods: string[] = [];
    const projectIds: Array<{ filename: string; projectId: string }> = [];

    for (const file of files) {
      const projectId = this.extractProjectId(file.infos);
      if (projectId) {
        projectIds.push({ filename: file.filename, projectId });
      }
    }

    if (projectIds.length === 0) {
      logger.info("未找到 Modrinth 项目 ID");
      return clientMods;
    }

    logger.info(`找到 ${projectIds.length} 个 Modrinth 项目`, { 数量: projectIds.length });

    const uniqueProjectIds = [...new Set(projectIds.map(p => p.projectId))];
    const projectMap = await this.fetchProjectInfo(uniqueProjectIds);

    for (const { filename, projectId } of projectIds) {
      const project = projectMap.get(projectId);
      if (project && this.isClientMod(project)) {
        clientMods.push(filename);
      }
    }

    logger.info("Modrinth 筛选完成", { 客户端模组数: clientMods.length });
    return clientMods;
  }
}
