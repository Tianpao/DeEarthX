/**
 * 模组筛选模块 - 类型定义
 */

/**
 * Mixin 配置文件信息
 */
export interface IMixinFile {
  name: string;
  data: string;
}

/**
 * 模组信息文件
 */
export interface IInfoFile {
  name: string;
  data: string;
}

/**
 * 模组文件信息
 */
export interface IFileInfo {
  filename: string;
  hash: string;
  mixins: IMixinFile[];
  infos: IInfoFile[];
  fileData?: Buffer;
}

/**
 * Modrinth Hash 响应
 */
export interface IHashResponse {
  [hash: string]: { project_id: string };
}

/**
 * Modrinth 项目信息
 */
export interface IProjectInfo {
  id: string;
  client_side: string;
  server_side: string;
}

/**
 * Dexpub 检查结果
 */
export interface IDexpubCheckResult {
  serverMods: string[];
  clientMods: string[];
}

/**
 * 筛选策略接口
 */
export interface IFilterStrategy {
  /**
   * 策略名称
   */
  name: string;
  
  /**
   * 筛选客户端模组
   * @param files 模组文件信息数组
   * @returns 客户端模组文件名数组
   */
  filter(files: IFileInfo[]): Promise<string[]>;
}

/**
 * 筛选配置
 */
export interface IFilterConfig {
  hashes: boolean;
  dexpub: boolean;
  mixins: boolean;
  modrinth: boolean;
}

/**
 * 模组兼容性类型
 */
export type ModSide = "required" | "optional" | "unsupported" | "unknown";

/**
 * 单个检查方法的结果
 */
export interface ISingleCheckResult {
  source: string;
  clientSide: ModSide;
  serverSide: ModSide;
  checked: boolean;
  error?: string;
}

/**
 * 模组检查结果 - 包含所有检查方法的结果
 */
export interface IModCheckResult {
  filename: string;
  filePath: string;
  clientSide: ModSide;
  serverSide: ModSide;
  source: string;
  checked: boolean;
  errors?: string[];
  allResults: ISingleCheckResult[];
  modId?: string;
  iconUrl?: string;
  description?: string;
  author?: string;
}

/**
 * 模组检查配置
 */
export interface IModCheckConfig {
  enableDexpub: boolean;
  enableModrinth: boolean;
  enableMixin: boolean;
  enableHash: boolean;
  timeout: number;
}
