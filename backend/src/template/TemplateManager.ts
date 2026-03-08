import fs from "node:fs/promises";
import path from "node:path";
import { getAppDir } from "../utils/utils.js";

interface TemplateMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  created: string;
  type: string;
}

export class TemplateManager {
  private readonly templatesPath: string;

  constructor(templatesPath?: string) {
    this.templatesPath = templatesPath || path.join(getAppDir(), "templates");
  }

  async ensureDefaultTemplate(): Promise<void> {
    const examplePath = path.join(this.templatesPath, "example");
    const metadataPath = path.join(examplePath, "metadata.json");
    const dataPath = path.join(examplePath, "data");

    try {
      await fs.access(metadataPath);
    } catch {
      await this.createTemplate("example", {
        name: "example",
        version: "1.0.0",
        description: "Example template for DeEarthX",
        author: "DeEarthX",
        created: new Date().toISOString().split("T")[0],
        type: "template",
      });
      
      await fs.mkdir(dataPath, { recursive: true });
      
      const readmePath = path.join(dataPath, "README.txt");
      await fs.writeFile(readmePath, "This is an example template for DeEarthX.\nPlace your server files in this data folder.");
    }
  }

  async createTemplate(name: string, metadata: Partial<TemplateMetadata>): Promise<void> {
    const templatePath = path.join(this.templatesPath, name);

    await fs.mkdir(templatePath, { recursive: true });

    const defaultMetadata: TemplateMetadata = {
      name,
      version: "1.0.0",
      description: "",
      author: "",
      created: new Date().toISOString().split("T")[0],
      type: "template",
      ...metadata,
    };

    const metadataPath = path.join(templatePath, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(defaultMetadata, null, 2));
    
    const dataPath = path.join(templatePath, "data");
    await fs.mkdir(dataPath, { recursive: true });
  }

  async getTemplates(): Promise<Array<{ id: string; metadata: TemplateMetadata }>> {
    try {
      const entries = await fs.readdir(this.templatesPath, { withFileTypes: true });
      const templates: Array<{ id: string; metadata: TemplateMetadata }> = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const templateId = entry.name;
          const metadataPath = path.join(this.templatesPath, templateId, "metadata.json");

          try {
            const metadataContent = await fs.readFile(metadataPath, "utf-8");
            const metadata: TemplateMetadata = JSON.parse(metadataContent);
            templates.push({ id: templateId, metadata });
          } catch (error) {
            console.warn(`Failed to read metadata for template ${templateId}:`, error);
          }
        }
      }

      return templates;
    } catch (error) {
      console.error("Failed to read templates directory:", error);
      return [];
    }
  }

  async updateTemplate(templateId: string, metadata: Partial<TemplateMetadata>): Promise<void> {
    const templatePath = path.join(this.templatesPath, templateId);
    const metadataPath = path.join(templatePath, "metadata.json");

    try {
      await fs.access(metadataPath);
    } catch {
      throw new Error(`Template ${templateId} does not exist`);
    }

    const existingMetadataContent = await fs.readFile(metadataPath, "utf-8");
    const existingMetadata: TemplateMetadata = JSON.parse(existingMetadataContent);

    const updatedMetadata: TemplateMetadata = {
      ...existingMetadata,
      ...metadata,
    };

    await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));
  }
}