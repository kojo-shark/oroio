import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, RefreshCw, Terminal, CheckCircle2, Copy, Circle } from 'lucide-react';
import { decryptKeys, maskKey } from '@/utils/crypto';
import { fetchEncryptedKeys, fetchCurrentIndex, fetchCache, addKey, removeKey, useKey, refreshCache } from '@/utils/api';
import type { KeyInfo, KeyUsage } from '@/utils/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function formatNumber(n: number | null): string {
  if (n === null) return '?';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n).toString();
}

function UsageCell({ usage }: { usage: KeyUsage | null }) {
  if (!usage || usage.total === null) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  const used = usage.used ?? 0;
  const total = usage.total;
  const isLow = usage.balance != null && total > 0 && usage.balance / total <= 0.1;
  const isZero = usage.balance != null && usage.balance <= 0;
  
  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatNumber(used)} / {formatNumber(total)}</span>
      </div>
      <Progress 
        value={used} 
        max={total} 
        className="w-full h-2"
        indicatorClassName={isZero ? 'bg-destructive' : isLow ? 'bg-yellow-500' : 'bg-green-500'}
      />
    </div>
  );
}

function KeyDisplay({ keyText, isCurrent, className }: { keyText: string, isCurrent: boolean, className?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(keyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={cn("flex items-center gap-2 group cursor-pointer select-none w-fit", className)}
      onClick={handleCopy}
      title="Click to copy key"
    >
      <code className={cn("text-sm relative font-mono transition-colors", isCurrent && "font-medium text-cyan-600 dark:text-cyan-400")}>
        {maskKey(keyText)}
      </code>
      <div className="w-4 h-4 flex items-center justify-center">
        {copied ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-all duration-200" />
        )}
      </div>
    </div>
  );
}

function IconCopyButton({ text, icon: Icon, title, className }: { text: string; icon: any; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className={cn("h-8 w-8", className)} title={title}>
      {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Icon className="h-4 w-4" />}
    </Button>
  );
}

export default function KeyList() {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [newKey, setNewKey] = useState('');
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      setError(null);
      
      const [encryptedData, currentIndex, cache] = await Promise.all([
        fetchEncryptedKeys(),
        fetchCurrentIndex(),
        fetchCache(),
      ]);
      
      const decryptedKeys = decryptKeys(encryptedData);
      
      const keyInfos: KeyInfo[] = decryptedKeys.map((key, idx) => ({
        key,
        index: idx + 1,
        isCurrent: idx + 1 === currentIndex,
        usage: cache.get(idx) || null,
      }));
      
      setKeys(keyInfos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCache();
    await loadData(true);
  };

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    setAdding(true);
    const result = await addKey(newKey.trim());
    if (result.success) {
      setNewKey('');
      setAddDialogOpen(false);
      await loadData(true);
    } else {
      alert(result.error || 'Failed to add key');
    }
    setAdding(false);
  };

  const handleRemoveKey = (index: number) => {
    setDeleteIndex(index);
  };

  const confirmDelete = async () => {
    if (deleteIndex === null) return;
    const result = await removeKey(deleteIndex);
    if (result.success) {
      await loadData(true);
    } else {
      alert(result.error || 'Failed to remove key');
    }
    setDeleteIndex(null);
  };

  const handleUseKey = async (index: number) => {
    const result = await useKey(index);
    if (result.success) {
      await loadData(true);
    } else {
      alert(result.error || 'Failed to switch key');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => loadData()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Access Keys</h1>
          <p className="text-muted-foreground">
            Manage your Factory API keys <span className="text-muted-foreground/50">·</span> {keys.length} {keys.length === 1 ? 'key' : 'keys'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Key</DialogTitle>
                <DialogDescription>Enter your Factory API key below.</DialogDescription>
              </DialogHeader>
              <Input
                placeholder="fk-..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddKey} disabled={adding || !newKey.trim()}>
                  {adding ? 'Adding...' : 'Add Key'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-12">No</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="w-24 text-right">Used</TableHead>
              <TableHead className="pl-8">Expiry</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((info) => {
              const isInvalid = info.usage?.raw?.startsWith('http_') ?? false;
              const percent = info.usage?.total ? Math.round((info.usage.used || 0) / info.usage.total * 100) : 0;
              
              return (
                <TableRow 
                  key={info.index} 
                  className={info.isCurrent 
                    ? 'bg-green-50/60 hover:bg-green-100/60 dark:bg-green-900/20 dark:hover:bg-green-900/30' 
                    : ''
                  }
                >
                  <TableCell>
                    <div 
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-colors",
                        info.isCurrent 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-muted-foreground/30 hover:text-primary"
                      )}
                      onClick={() => !info.isCurrent && handleUseKey(info.index)}
                      title={info.isCurrent ? "Currently Active" : "Set as Active"}
                    >
                      {info.isCurrent ? (
                        <CheckCircle2 className="h-5 w-5 fill-green-500 text-white" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {info.index}
                  </TableCell>
                  <TableCell>
                    <KeyDisplay 
                      keyText={info.key} 
                      isCurrent={info.isCurrent} 
                    />
                  </TableCell>
                  <TableCell>
                    <UsageCell usage={info.usage} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {info.usage?.total ? `${percent}%` : '-'}
                  </TableCell>
                  <TableCell className="pl-8">
                    {isInvalid ? (
                      <Badge variant="destructive">Invalid</Badge>
                    ) : (
                      <span className="text-sm">{info.usage?.expires || '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <IconCopyButton 
                        text={`export FACTORY_API_KEY=${info.key}`} 
                        icon={Terminal} 
                        title="Copy Export Command" 
                      />
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => handleRemoveKey(info.index)}
                        title="Delete Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete Key #{deleteIndex} from your configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
