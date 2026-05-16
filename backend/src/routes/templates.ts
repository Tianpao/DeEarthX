import { Application } from "express";
import { logger } from "../utils/logger.js";

export function setupTemplateRoutes(app: Application): void {
  // 获取模板列表
  app.get('/templates', async (req, res) => {
    try {
      const templateModule = await import('../template/index.js');
      const TemplateManager = (templateModule as any).TemplateManager;
      const templateManager = new TemplateManager();
      const templates = await templateManager.getTemplates();

      res.json({
        status: 200,
        data: templates
      });
    } catch (err) {
      const error = err as Error;
      logger.error("/templates 路由错误", error);
      res.status(500).json({ status: 500, message: "获取模板列表失败" });
    }
  });

  // 创建模板
  app.post('/templates', async (req, res) => {
    try {
      const { name, version, description, author } = req.body;

      if (!name) {
        res.status(400).json({ status: 400, message: "模板名称不能为空" });
        return;
      }

      const templateModule = await import('../template/index.js');
      const TemplateManager = (templateModule as any).TemplateManager;
      const templateManager = new TemplateManager();

      const templateId = `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      await templateManager.createTemplate(templateId, {
        name,
        version: version || '1.0.0',
        description: description || '',
        author: author || '',
        created: new Date().toISOString().split("T")[0],
        type: 'template'
      });

      res.json({
        status: 200,
        message: "模板创建成功",
        data: { id: templateId }
      });
    } catch (err) {
      const error = err as Error;
      logger.error("/templates POST 路由错误", error);
      res.status(500).json({ status: 500, message: "创建模板失败" });
    }
  });

  // 删除模板
  app.delete('/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const templateModule = await import('../template/index.js');
      const TemplateService = (templateModule as any).TemplateService;
      const templateService = new TemplateService();

      const success = await templateService.deleteTemplate(id);

      if (success) {
        res.json({
          status: 200,
          message: "模板删除成功"
        });
      } else {
        res.status(404).json({ status: 404, message: "模板不存在" });
      }
    } catch (err) {
      const error = err as Error;
      logger.error(`/templates/${req.params.id} DELETE 路由错误`, error);
      res.status(500).json({ status: 500, message: "删除模板失败" });
    }
  });

  // 修改模板信息
  app.put('/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, version, description, author } = req.body;

      if (!name) {
        res.status(400).json({ status: 400, message: "模板名称不能为空" });
        return;
      }

      const templateModule = await import('../template/index.js');
      const TemplateManager = (templateModule as any).TemplateManager;
      const templateManager = new TemplateManager();

      await templateManager.updateTemplate(id, {
        name,
        version: version || '1.0.0',
        description: description || '',
        author: author || '',
        type: 'template'
      });

      res.json({
        status: 200,
        message: "模板更新成功"
      });
    } catch (err) {
      const error = err as Error;
      logger.error(`/templates/${req.params.id} PUT 路由错误`, error);
      res.status(500).json({ status: 500, message: "更新模板失败" });
    }
  });

  // 打开模板文件夹
  app.get('/templates/:id/path', async (req, res) => {
    try {
      const { id } = req.params;
      const path = await import('path');
      const { exec } = await import('child_process');
      const templateModule = await import('../template/index.js');
      const TemplateManager = (templateModule as any).TemplateManager;

      const templateManager = new TemplateManager();
      const templatesPath = (templateManager as any).templatesPath;
      const templatePath = path.resolve(templatesPath, id);

      const platform = process.platform;
      let command: string;

      if (platform === 'win32') {
        command = `explorer "${templatePath}"`;
      } else if (platform === 'darwin') {
        command = `open "${templatePath}"`;
      } else {
        command = `xdg-open "${templatePath}"`;
      }

      exec(command, (error) => {
        res.json({
          status: 200,
          message: "文件夹已打开"
        });
      });
    } catch (err) {
      const error = err as Error;
      logger.error(`/templates/${req.params.id}/path 路由错误`, error);
      res.status(500).json({ status: 500, message: "打开文件夹失败" });
    }
  });
}
