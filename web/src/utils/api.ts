export interface KeyUsage {
  balance: number | null;
  total: number | null;
  used: number | null;
  expires: string;
  raw: string;
}

export interface KeyInfo {
  key: string;
  index: number;
  isCurrent: boolean;
  usage: KeyUsage | null;
}

export async function fetchEncryptedKeys(): Promise<ArrayBuffer> {
  const res = await fetch('/data/keys.enc');
  if (!res.ok) throw new Error('Failed to fetch keys.enc');
  return res.arrayBuffer();
}

export async function fetchCurrentIndex(): Promise<number> {
  const res = await fetch('/data/current');
  if (!res.ok) return 1;
  const text = await res.text();
  return parseInt(text.trim(), 10) || 1;
}

export async function fetchCache(): Promise<Map<number, KeyUsage>> {
  const res = await fetch('/data/list_cache.b64');
  if (!res.ok) return new Map();
  
  const text = await res.text();
  const lines = text.split('\n');
  if (lines.length < 3) return new Map();
  
  const result = new Map<number, KeyUsage>();
  
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [idxStr, b64] = line.split('\t');
    if (!idxStr || !b64) continue;
    
    try {
      const decoded = atob(b64);
      const usage = parseUsageInfo(decoded);
      result.set(parseInt(idxStr, 10), usage);
    } catch {
      // skip invalid entries
    }
  }
  
  return result;
}

function parseUsageInfo(text: string): KeyUsage {
  const lines = text.split('\n');
  const data: Record<string, string> = {};
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    if (key) {
      data[key] = valueParts.join('=');
    }
  }
  
  return {
    balance: data['BALANCE_NUM'] ? parseFloat(data['BALANCE_NUM']) : null,
    total: data['TOTAL'] ? parseFloat(data['TOTAL']) : null,
    used: data['USED'] ? parseFloat(data['USED']) : null,
    expires: data['EXPIRES'] || '?',
    raw: data['RAW'] || '',
  };
}

export async function addKey(key: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  return res.json();
}

export async function removeKey(index: number): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  });
  return res.json();
}

export async function useKey(index: number): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/use', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index }),
  });
  return res.json();
}

export async function refreshCache(): Promise<{ success: boolean }> {
  const res = await fetch('/api/refresh', { method: 'POST' });
  return res.json();
}
