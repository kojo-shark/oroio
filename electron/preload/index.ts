import { contextBridge, ipcRenderer } from 'electron';

export interface Skill {
  name: string;
  path: string;
}

export interface Command {
  name: string;
  path: string;
  description?: string;
  content?: string;
}

export interface Droid {
  name: string;
  path: string;
}

export interface McpServer {
  name: string;
  type?: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface DkCheckResult {
  installed: boolean;
  installCmd: string;
  platform: string;
}

export interface OroioAPI {
  keys: {
    list: () => Promise<any[]>;
    current: () => Promise<any | null>;
    add: (key: string) => Promise<{ success: boolean; message?: string; error?: string }>;
    remove: (index: number) => Promise<{ success: boolean; message?: string; error?: string }>;
    use: (index: number) => Promise<{ success: boolean; message?: string; error?: string }>;
    refresh: () => Promise<{ success: boolean; error?: string }>;
  };
  data: {
    read: (filename: string) => Promise<ArrayBuffer | null>;
  };
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
  // dk CLI check
  checkDk: () => Promise<DkCheckResult>;
  // Skills
  listSkills: () => Promise<Skill[]>;
  createSkill: (name: string) => Promise<void>;
  deleteSkill: (name: string) => Promise<void>;
  // Commands
  listCommands: () => Promise<Command[]>;
  createCommand: (name: string) => Promise<void>;
  deleteCommand: (name: string) => Promise<void>;
  getCommandContent: (name: string) => Promise<string>;
  updateCommand: (name: string, content: string) => Promise<void>;
  // Droids
  listDroids: () => Promise<Droid[]>;
  createDroid: (name: string) => Promise<void>;
  deleteDroid: (name: string) => Promise<void>;
  // MCP
  listMcpServers: () => Promise<McpServer[]>;
  addMcpServer: (name: string, command: string, args: string[]) => Promise<void>;
  removeMcpServer: (name: string) => Promise<void>;
  updateMcpServer: (name: string, config: Omit<McpServer, 'name'>) => Promise<void>;
  openMcpConfig: () => Promise<void>;
  // Utilities
  openPath: (path: string) => Promise<void>;
}

const api: OroioAPI = {
  keys: {
    list: () => ipcRenderer.invoke('keys:list'),
    current: () => ipcRenderer.invoke('keys:current'),
    add: (key: string) => ipcRenderer.invoke('keys:add', key),
    remove: (index: number) => ipcRenderer.invoke('keys:remove', index),
    use: (index: number) => ipcRenderer.invoke('keys:use', index),
    refresh: () => ipcRenderer.invoke('keys:refresh'),
  },
  data: {
    read: async (filename: string): Promise<ArrayBuffer | null> => {
      const buffer = await ipcRenderer.invoke('data:read', filename);
      if (buffer) {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      }
      return null;
    },
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  // dk CLI check
  checkDk: () => ipcRenderer.invoke('dk:check'),
  // Skills
  listSkills: () => ipcRenderer.invoke('skills:list'),
  createSkill: (name: string) => ipcRenderer.invoke('skills:create', name),
  deleteSkill: (name: string) => ipcRenderer.invoke('skills:delete', name),
  // Commands
  listCommands: () => ipcRenderer.invoke('commands:list'),
  createCommand: (name: string) => ipcRenderer.invoke('commands:create', name),
  deleteCommand: (name: string) => ipcRenderer.invoke('commands:delete', name),
  getCommandContent: (name: string) => ipcRenderer.invoke('commands:content', name),
  updateCommand: (name: string, content: string) => ipcRenderer.invoke('commands:update', name, content),
  // Droids
  listDroids: () => ipcRenderer.invoke('droids:list'),
  createDroid: (name: string) => ipcRenderer.invoke('droids:create', name),
  deleteDroid: (name: string) => ipcRenderer.invoke('droids:delete', name),
  // MCP
  listMcpServers: () => ipcRenderer.invoke('mcp:list'),
  addMcpServer: (name: string, command: string, args: string[]) => ipcRenderer.invoke('mcp:add', name, command, args),
  removeMcpServer: (name: string) => ipcRenderer.invoke('mcp:remove', name),
  updateMcpServer: (name: string, config: Omit<McpServer, 'name'>) => ipcRenderer.invoke('mcp:update', name, config),
  openMcpConfig: () => ipcRenderer.invoke('mcp:openConfig'),
  // Utilities
  openPath: (p: string) => ipcRenderer.invoke('util:openPath', p),
};

contextBridge.exposeInMainWorld('oroio', api);

declare global {
  interface Window {
    oroio: OroioAPI;
  }
}
