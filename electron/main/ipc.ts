import { ipcMain, BrowserWindow, shell } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import {
  getKeyList,
  getCurrentKey,
  addKey,
  removeKey,
  useKey,
  refreshCache,
  type KeyInfo,
} from './keyManager';
import { updateTrayMenu } from './tray';
import { checkAndNotify } from './notifier';

const OROIO_DIR = path.join(os.homedir(), '.oroio');
const FACTORY_DIR = path.join(os.homedir(), '.factory');

interface Skill {
  name: string;
  path: string;
}

interface Command {
  name: string;
  path: string;
  description?: string;
  content?: string;
}

interface Droid {
  name: string;
  path: string;
}

interface McpServer {
  name: string;
  type?: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export function registerIpcHandlers(): void {
  // Get all keys
  ipcMain.handle('keys:list', async (): Promise<KeyInfo[]> => {
    return getKeyList();
  });

  // Get current key
  ipcMain.handle('keys:current', async (): Promise<KeyInfo | null> => {
    return getCurrentKey();
  });

  // Add a key
  ipcMain.handle('keys:add', async (_event, key: string) => {
    const result = await addKey(key);
    if (result.success) {
      const keys = await getKeyList();
      updateTrayMenu(keys);
      notifyAllWindows('keys-changed');
    }
    return result;
  });

  // Remove a key
  ipcMain.handle('keys:remove', async (_event, index: number) => {
    const result = await removeKey(index);
    if (result.success) {
      const keys = await getKeyList();
      updateTrayMenu(keys);
      checkAndNotify(keys);
      notifyAllWindows('keys-changed');
    }
    return result;
  });

  // Switch to a key
  ipcMain.handle('keys:use', async (_event, index: number) => {
    const result = await useKey(index);
    if (result.success) {
      const keys = await getKeyList();
      updateTrayMenu(keys);
      notifyAllWindows('keys-changed');
    }
    return result;
  });

  // Refresh cache
  ipcMain.handle('keys:refresh', async () => {
    const result = await refreshCache();
    if (result.success) {
      const keys = await getKeyList();
      updateTrayMenu(keys);
      checkAndNotify(keys);
      notifyAllWindows('keys-changed');
    }
    return result;
  });

  // Read raw data file (for web compatibility)
  ipcMain.handle('data:read', async (_event, filename: string): Promise<Buffer | null> => {
    const allowedFiles = ['keys.enc', 'current', 'list_cache.b64'];
    if (!allowedFiles.includes(filename)) {
      return null;
    }
    
    try {
      const filepath = path.join(OROIO_DIR, filename);
      return await fs.readFile(filepath);
    } catch {
      return null;
    }
  });

  // Skills handlers
  ipcMain.handle('skills:list', async (): Promise<Skill[]> => {
    const skillsDir = path.join(FACTORY_DIR, 'skills');
    try {
      const realDir = await fs.realpath(skillsDir);
      const entries = await fs.readdir(realDir, { withFileTypes: true });
      const skills: Skill[] = [];
      for (const entry of entries) {
        const entryPath = path.join(realDir, entry.name);
        const stat = await fs.stat(entryPath);
        if (stat.isDirectory()) {
          const skillPath = path.join(entryPath, 'SKILL.md');
          try {
            await fs.access(skillPath);
            skills.push({ name: entry.name, path: skillPath });
          } catch {
            // Skip directories without SKILL.md
          }
        }
      }
      return skills;
    } catch {
      return [];
    }
  });

  ipcMain.handle('skills:create', async (_event, name: string): Promise<void> => {
    const skillDir = path.join(FACTORY_DIR, 'skills', name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(skillFile, `# ${name}\n\nDescribe your skill instructions here.\n`);
  });

  ipcMain.handle('skills:delete', async (_event, name: string): Promise<void> => {
    const skillDir = path.join(FACTORY_DIR, 'skills', name);
    await fs.rm(skillDir, { recursive: true, force: true });
  });

  // Commands handlers
  const parseCommandFile = (content: string) => {
    let description = '';
    let body = content;
    if (content.startsWith('---')) {
      const endIdx = content.indexOf('---', 3);
      if (endIdx !== -1) {
        const frontmatter = content.slice(3, endIdx);
        const descMatch = frontmatter.match(/description:\s*(.+)/);
        if (descMatch) description = descMatch[1].trim();
        body = content.slice(endIdx + 3).trim();
      }
    }
    return { description, body };
  };

  ipcMain.handle('commands:list', async (): Promise<Command[]> => {
    const commandsDir = path.join(FACTORY_DIR, 'commands');
    try {
      const realDir = await fs.realpath(commandsDir);
      const entries = await fs.readdir(realDir, { withFileTypes: true });
      const commands: Command[] = [];
      for (const entry of entries) {
        if (entry.name.endsWith('.md')) {
          const fullPath = path.join(realDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            const raw = await fs.readFile(fullPath, 'utf-8');
            const { description, body } = parseCommandFile(raw);
            commands.push({
              name: entry.name.replace('.md', ''),
              path: fullPath,
              description,
              content: body,
            });
          }
        }
      }
      return commands;
    } catch {
      return [];
    }
  });

  ipcMain.handle('commands:create', async (_event, name: string): Promise<void> => {
    const commandsDir = path.join(FACTORY_DIR, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });
    const commandFile = path.join(commandsDir, `${name}.md`);
    await fs.writeFile(commandFile, `---
description: Description of your command
---

# /${name}

Command instructions here.
`);
  });

  ipcMain.handle('commands:delete', async (_event, name: string): Promise<void> => {
    const commandFile = path.join(FACTORY_DIR, 'commands', `${name}.md`);
    await fs.unlink(commandFile);
  });

  ipcMain.handle('commands:content', async (_event, name: string): Promise<string> => {
    const commandsDir = path.join(FACTORY_DIR, 'commands');
    const realDir = await fs.realpath(commandsDir);
    return await fs.readFile(path.join(realDir, `${name}.md`), 'utf-8');
  });

  ipcMain.handle('commands:update', async (_event, name: string, content: string): Promise<void> => {
    const commandsDir = path.join(FACTORY_DIR, 'commands');
    const realDir = await fs.realpath(commandsDir);
    await fs.writeFile(path.join(realDir, `${name}.md`), content);
  });

  // Droids handlers
  ipcMain.handle('droids:list', async (): Promise<Droid[]> => {
    const droidsDir = path.join(FACTORY_DIR, 'droids');
    try {
      const realDir = await fs.realpath(droidsDir);
      const entries = await fs.readdir(realDir, { withFileTypes: true });
      const droids: Droid[] = [];
      for (const entry of entries) {
        if (entry.name.endsWith('.md')) {
          const fullPath = path.join(realDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (stat.isFile()) {
            droids.push({
              name: entry.name.replace('.md', ''),
              path: fullPath,
            });
          }
        }
      }
      return droids;
    } catch {
      return [];
    }
  });

  ipcMain.handle('droids:create', async (_event, name: string): Promise<void> => {
    const droidsDir = path.join(FACTORY_DIR, 'droids');
    await fs.mkdir(droidsDir, { recursive: true });
    const droidFile = path.join(droidsDir, `${name}.md`);
    await fs.writeFile(droidFile, `---
name: ${name}
description: A custom droid
---

# ${name}

Droid instructions here.
`);
  });

  ipcMain.handle('droids:delete', async (_event, name: string): Promise<void> => {
    const droidFile = path.join(FACTORY_DIR, 'droids', `${name}.md`);
    await fs.unlink(droidFile);
  });

  // MCP handlers
  ipcMain.handle('mcp:list', async (): Promise<McpServer[]> => {
    const mcpConfig = path.join(FACTORY_DIR, 'mcp.json');
    try {
      const content = await fs.readFile(mcpConfig, 'utf-8');
      const config = JSON.parse(content);
      const servers: McpServer[] = [];
      if (config.mcpServers) {
        for (const [name, server] of Object.entries(config.mcpServers)) {
          const s = server as { type?: string; command?: string; args?: string[]; url?: string; env?: Record<string, string> };
          servers.push({
            name,
            type: (s.type as 'stdio' | 'http') || 'stdio',
            command: s.command,
            args: s.args,
            url: s.url,
            env: s.env
          });
        }
      }
      return servers;
    } catch {
      return [];
    }
  });

  ipcMain.handle('mcp:add', async (_event, name: string, command: string, args: string[]): Promise<void> => {
    const mcpConfig = path.join(FACTORY_DIR, 'mcp.json');
    let config: { mcpServers: Record<string, { type: string; command: string; args: string[] }> } = { mcpServers: {} };
    try {
      const content = await fs.readFile(mcpConfig, 'utf-8');
      config = JSON.parse(content);
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      // File doesn't exist, use empty config
    }
    config.mcpServers[name] = { type: 'stdio', command, args };
    await fs.mkdir(FACTORY_DIR, { recursive: true });
    await fs.writeFile(mcpConfig, JSON.stringify(config, null, 2));
  });

  ipcMain.handle('mcp:remove', async (_event, name: string): Promise<void> => {
    const mcpConfig = path.join(FACTORY_DIR, 'mcp.json');
    try {
      const content = await fs.readFile(mcpConfig, 'utf-8');
      const config = JSON.parse(content);
      if (config.mcpServers && config.mcpServers[name]) {
        delete config.mcpServers[name];
        await fs.writeFile(mcpConfig, JSON.stringify(config, null, 2));
      }
    } catch {
      // Config doesn't exist
    }
  });

  ipcMain.handle('mcp:update', async (_event, name: string, serverConfig: Omit<McpServer, 'name'>): Promise<void> => {
    const mcpConfig = path.join(FACTORY_DIR, 'mcp.json');
    let config: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
    try {
      const content = await fs.readFile(mcpConfig, 'utf-8');
      config = JSON.parse(content);
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      // File doesn't exist
    }
    config.mcpServers[name] = serverConfig;
    await fs.mkdir(FACTORY_DIR, { recursive: true });
    await fs.writeFile(mcpConfig, JSON.stringify(config, null, 2));
  });

  ipcMain.handle('mcp:openConfig', async (): Promise<void> => {
    const mcpConfig = path.join(FACTORY_DIR, 'mcp.json');
    try {
      await fs.access(mcpConfig);
    } catch {
      await fs.mkdir(FACTORY_DIR, { recursive: true });
      await fs.writeFile(mcpConfig, JSON.stringify({ mcpServers: {} }, null, 2));
    }
    await shell.openPath(mcpConfig);
  });

  // Utility handlers
  ipcMain.handle('util:openPath', async (_event, filePath: string): Promise<void> => {
    await shell.openPath(filePath);
  });

  // dk CLI check
  ipcMain.handle('dk:check', async (): Promise<{ installed: boolean; installCmd: string; platform: string }> => {
    const platform = os.platform();
    const cmd = platform === 'win32' ? 'where dk' : 'which dk';
    const installed = await new Promise<boolean>((resolve) => {
      exec(cmd, (error) => resolve(!error));
    });
    const installCmd = platform === 'win32'
      ? 'irm https://raw.githubusercontent.com/notdp/oroio/main/install.ps1 | iex'
      : 'curl -fsSL https://raw.githubusercontent.com/notdp/oroio/main/install.sh | bash';
    return { installed, installCmd, platform };
  });
}

function notifyAllWindows(channel: string, ...args: any[]): void {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  });
}
