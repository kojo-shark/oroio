import { useState, useEffect, useCallback } from 'react';
import { Key, Sparkles, Terminal, Bot, Plug, Github, Volume2, VolumeX, Sun, Moon, Command } from 'lucide-react';
import { useSound } from '@/hooks/useSound';
import { Toaster } from 'sonner';
import KeyList, { showDkMissingToast } from '@/components/KeyList';
import SkillsManager from '@/components/SkillsManager';
import CommandsManager from '@/components/CommandsManager';
import DroidsManager from '@/components/DroidsManager';
import McpManager from '@/components/McpManager';
import PinDialog from '@/components/PinDialog';
import { cn } from '@/lib/utils';
import { checkAuth, authenticate, isElectron, checkDk } from '@/utils/api';

type Tab = 'keys' | 'commands' | 'skills' | 'droids' | 'mcp';

const tabs: { id: Tab; label: string; icon: typeof Key }[] = [
  { id: 'keys', label: 'KEYS', icon: Key },
  { id: 'commands', label: 'COMMANDS', icon: Command },
  { id: 'skills', label: 'SKILLS', icon: Sparkles },
  { id: 'droids', label: 'DROIDS', icon: Bot },
  { id: 'mcp', label: 'MCP', icon: Plug },
];

export default function App() {
  const sound = useSound();
  const [activeTab, setActiveTab] = useState<Tab>('keys');
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('oroio-theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Auth state
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [dkMissing, setDkMissing] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const initChecks = async () => {
      if (isElectron) {
        setAuthenticated(true);
        setAuthChecking(false);
        // Check DK status
        try {
          const dkResult = await checkDk();
          if (dkResult && !dkResult.installed) {
            setDkMissing(true);
          }
        } catch (e) {
          console.error("Failed to check DK status", e);
        }
        return;
      }

      try {
        const result = await checkAuth();
        setAuthRequired(result.required);
        setAuthenticated(result.authenticated);
      } catch {
        setAuthenticated(true);
      } finally {
        setAuthChecking(false);
      }
    };
    initChecks();
  }, []);

  const handlePinSubmit = async (pin: string): Promise<boolean> => {
    setAuthError(undefined);
    const result = await authenticate(pin);
    if (result.success) {
      setAuthenticated(true);
      return true;
    }
    setAuthError(result.error || 'Invalid PIN');
    return false;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      sound.click();
      setActiveTab(prev => {
        const currentIndex = tabs.findIndex(t => t.id === prev);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length;
        return tabs[nextIndex].id;
      });
    }
  }, [sound]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('oroio-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!mounted || authChecking) return null;

  // Show PIN dialog if auth is required but not authenticated
  if (authRequired && !authenticated) {
    return <PinDialog onSubmit={handlePinSubmit} error={authError} />;
  }

  return (
    <div className="h-screen bg-background text-foreground font-mono selection:bg-primary selection:text-primary-foreground relative overflow-hidden transition-colors duration-300 flex flex-col">
      <Toaster position="bottom-center" theme={theme} richColors />
      <div className="scanline" />
      <div className="w-full flex-1 flex relative z-10 min-h-0">
        {/* Sidebar Navigation - VSCode style */}
        <nav className="w-12 shrink-0 border-r border-border bg-card flex flex-col items-center pt-2">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { sound.click(); setActiveTab(id); }}
                className={cn(
                  "relative w-12 h-12 flex items-center justify-center transition-colors cursor-pointer outline-none",
                  isActive
                    ? "text-primary"
                    : "text-primary/40 hover:text-primary/70 dark:text-[#858585] dark:hover:text-primary/70"
                )}
                title={label}
              >
                {isActive && (
                  <span className="absolute inset-1.5 bg-[#DDDDE2] dark:bg-primary/20" style={{ borderRadius: '6px' }} />
                )}
                <Icon className="w-6 h-6 relative z-10" strokeWidth={1.5} />
              </button>
            );
          })}
        </nav>

        {/* Right side: header + content + footer */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <header className="border-b border-border px-4 md:px-6 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                <span className="font-pixel text-lg tracking-tighter mt-0.5 text-primary leading-none">OROIO</span>
              </h1>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex h-7 items-center border border-border bg-card divide-x divide-border">
                  <button
                    onClick={() => { sound.toggleSound(); setTheme(theme === 'light' ? 'dark' : 'light'); }}
                    className="flex items-center justify-center w-9 h-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={theme === 'light' ? "Switch to dark mode" : "Switch to light mode"}
                  >
                    {theme === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { if (sound.muted) { sound.toggle(); sound.toggleSound(); } else { sound.toggleSound(); sound.toggle(); } }}
                    className="flex items-center justify-center w-9 h-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={sound.muted ? "Unmute sounds" : "Mute sounds"}
                  >
                    {sound.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6 overflow-auto">
            <h2 className="text-sm font-bold text-primary mb-4">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            {activeTab === 'keys' && <KeyList />}
            {activeTab === 'commands' && <CommandsManager />}
            {activeTab === 'skills' && <SkillsManager />}
            {activeTab === 'droids' && <DroidsManager />}
            {activeTab === 'mcp' && <McpManager />}
          </main>
        </div>
      </div>
      {/* Footer */}
      <footer className="bg-primary text-primary-foreground px-3 py-1 flex justify-between items-center text-[10px] shrink-0">
        <span className="inline-flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              dkMissing && "cursor-pointer hover:opacity-80"
            )}
            onClick={async () => {
              if (dkMissing && isElectron) {
                const result = await checkDk();
                if (result && !result.installed) {
                  showDkMissingToast(result.installCmd);
                }
              }
            }}
          >
            <svg width="6" height="6" viewBox="0 0 6 6" className="shrink-0">
              <circle cx="3" cy="3" r="3" className={cn(dkMissing ? "fill-amber-400 animate-pulse" : "fill-emerald-400")} />
            </svg>
            {dkMissing ? "DK_MISSING" : "READY"}
          </span>
          <span className="opacity-50">Tab to navigate</span>
        </span>
        <a href="https://github.com/notdp/oroio" target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
          <Github className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
}
