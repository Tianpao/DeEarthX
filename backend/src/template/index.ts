import fs from "node:fs/promises";
import path from "node:path";
import { TemplateManager } from "./TemplateManager.js";

export { TemplateManager };

interface TemplateMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  created: string;
  type: string;
}

export class TemplateService {
  private readonly templatesPath: string;

  constructor(templatesPath: string = "./templates") {
    this.templatesPath = templatesPath;
  }

  async getTemplate(name: string): Promise<TemplateMetadata | null> {
    const metadataPath = path.join(this.templatesPath, name, "metadata.json");

    try {
      const data = await fs.readFile(metadataPath, "utf-8");
      return JSON.parse(data) as TemplateMetadata;
    } catch {
      return null;
    }
  }

  async updateTemplate(name: string, metadata: Partial<TemplateMetadata>): Promise<boolean> {
    const currentMetadata = await this.getTemplate(name);

    if (!currentMetadata) {
      return false;
    }

    const updatedMetadata = { ...currentMetadata, ...metadata };
    const metadataPath = path.join(this.templatesPath, name, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));

    return true;
  }

  async deleteTemplate(name: string): Promise<boolean> {
    const templatePath = path.join(this.templatesPath, name);

    try {
      await fs.rm(templatePath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  async listTemplates(): Promise<TemplateMetadata[]> {
    const templates: TemplateMetadata[] = [];

    try {
      const entries = await fs.readdir(this.templatesPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metadata = await this.getTemplate(entry.name);
          if (metadata) {
            templates.push(metadata);
          }
        }
      }
    } catch {
      return [];
    }

    return templates;
  }

  async templateExists(name: string): Promise<boolean> {
    const metadataPath = path.join(this.templatesPath, name, "metadata.json");

    try {
      await fs.access(metadataPath);
      return true;
    } catch {
      return false;
    }
  }
}