import { IFilterStrategy, IFileInfo } from "../types.js";
import { logger } from "../../utils/logger.js";

/**
 * Modrinth 项目信息响应
 */
interface IModrinthProject {
  client_side: string;
  server_side: string;
  project_type: string;
  categories: string[];
}

/**
 * Modrinth 筛选策略 - 通过 Modrinth API 检查模组类型
 * 使用项目ID查询模组的 client_side 和 server_side 属性
 */
export class ModrinthFilterStrategy implements IFilterStrategy {
  name = "ModrinthFilter";

  private readonly API_BASE = "https://api.modrinth.com/v2";

  /**
   * 从 infos 数组中提取 Modrinth 项目ID
   */
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

  /**
   * 批量查询 Modrinth 项目信息
   */
  private async fetchProjectInfo(projectIds: string[]): Promise<Map<string, IModrinthProject>> {
    const projectMap = new Map<string, IModrinthProject>();

    // 分批查询，每次查询最多50个项目
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

          // Modrinth API 返回的项目数组，每个项目包含 id 字段
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

  /**
   * 判断是否为客户端模组
   */
  private isClientMod(project: IModrinthProject): boolean {
    const clientSide = project.client_side;
    const serverSide = project.server_side;

    // 客户端侧为 "required" 或者客户端侧为 "optional" 且服务端侧为 "unsupported"
    return (
      clientSide === "required" ||
      (clientSide === "optional" && serverSide === "unsupported")
    );
  }

  /**
   * 筛选客户端模组
   */
  async filter(files: IFileInfo[]): Promise<string[]> {
    const clientMods: string[] = [];
    const projectIds: Array<{ filename: string; projectId: string }> = [];

    // 提取所有 Modrinth 项目ID
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

    // 批量查询项目信息
    const uniqueProjectIds = [...new Set(projectIds.map(p => p.projectId))];
    const projectMap = await this.fetchProjectInfo(uniqueProjectIds);

    // 根据项目信息判断客户端模组
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
