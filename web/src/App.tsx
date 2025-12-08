import { useState, useEffect, useCallback } from 'react';
import { Key, Sparkles, Terminal, Bot, Plug, Github, Volume2, VolumeX, Sun, Moon, Command, Settings, Check, X } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { useSound } from '@/hooks/useSound';
import { Toaster } from 'sonner';
import KeyList, { showDkMissingToast } from '@/components/KeyList';
import SkillsManager from '@/components/SkillsManager';
import CommandsManager from '@/components/CommandsManager';
import DroidsManager from '@/components/DroidsManager';
import McpManager from '@/components/McpManager';
import PinDialog from '@/components/PinDialog';
import { cn } from '@/lib/utils';
import { checkAuth, authenticate, isElectron, checkDk, getDkConfig, setDkConfig, type DkConfig } from '@/utils/api';

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
  const [navStyle, setNavStyle] = useState<'sidebar' | 'top'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('oroio-nav-style') as 'sidebar' | 'top') || 'sidebar';
    }
    return 'sidebar';
  });
  const [showSettings, setShowSettings] = useState(false);

  // Auth state
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>();
  const [dkMissing, setDkMissing] = useState(false);
  const [dkConfig, setDkConfigState] = useState<DkConfig | null>(null);

  // Check auth on mount
  useEffect(() => {
    const initChecks = async () => {
      if (isElectron) {
        setAuthenticated(true);
        setAuthChecking(false);
      } else {
        try {
          const result = await checkAuth();
          setAuthRequired(result.required);
          setAuthenticated(result.authenticated);
        } catch {
          setAuthenticated(true);
        } finally {
          setAuthChecking(false);
        }
      }

      // Check DK status and load config (works in both Electron and web mode)
      try {
        const dkResult = await checkDk();
        if (dkResult && !dkResult.installed) {
          setDkMissing(true);
        } else {
          const config = await getDkConfig();
          if (config) setDkConfigState(config);
        }
      } catch (e) {
        console.error("Failed to check DK status", e);
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
    localStorage.setItem('oroio-nav-style', navStyle);
  }, [navStyle]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!mounted || authChecking) return null;

  // Show PIN dialog if auth is required but not authenticated
  if (authRequired && !authenticated) {
    return <PinDialog onSubmit={handlePinSubmit} error={authError} />;
  }

  // VSCode-style setting item component
  const SettingItem = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
    <div className="py-3 border-l-2 border-transparent hover:border-primary/50 pl-3 -ml-3">
      <div className="text-sm text-foreground">{title}</div>
      {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );

  // VSCode-style dropdown component
  const VscDropdown = ({ value, onChange, options }: { 
    value: string; 
    onChange: (value: string) => void; 
    options: { value: string; label: string; description?: string; isDefault?: boolean }[] 
  }) => {
    const [open, setOpen] = useState(false);
    const selected = options.find(o => o.value === value) || options[0];
    
    return (
      <div className="relative inline-block min-w-[250px]">
        <button
          onClick={() => { sound.click(); setOpen(!open); }}
          className="w-full flex items-center justify-between text-xs bg-background border border-border px-2 py-1 text-foreground cursor-pointer hover:border-primary/50"
        >
          <span>{selected.label}</span>
          <svg className="w-3 h-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border shadow-lg z-20 max-h-[200px] overflow-auto">
              {options.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { sound.click(); onChange(opt.value); setOpen(false); }}
                  className={cn(
                    "px-2 py-1.5 cursor-pointer text-xs",
                    opt.value === value ? "bg-primary/20" : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt.label}</span>
                    {opt.isDefault && <span className="text-primary text-[10px]">default</span>}
                  </div>
                  {opt.description && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // Settings page content - VSCode style
  const settingsContent = (
    <div className="space-y-1 max-w-2xl">
      {/* DK Settings */}
      <SettingItem
        title="DK: Status"
        description="The installation status of the dk command-line tool."
      >
        {dkMissing ? (
          <span className="text-xs text-destructive flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />
            Not Installed
          </span>
        ) : (
          <span className="text-xs text-emerald-500 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Installed
          </span>
        )}
      </SettingItem>

      {!dkMissing && dkConfig && (
        <SettingItem
          title="DK: ASCII Borders"
          description="Use ASCII characters for table borders (for terminals without UTF-8 support)."
        >
          <VscDropdown
            value={dkConfig.ascii || '0'}
            onChange={async (v) => {
              await setDkConfig({ ascii: v });
              const updated = await getDkConfig();
              if (updated) setDkConfigState(updated);
            }}
            options={[
              { value: '0', label: 'off', isDefault: true },
              { value: '1', label: 'on' },
            ]}
          />
        </SettingItem>
      )}

      {/* Navigation Style */}
      <SettingItem
        title="Editor: Navigation Style"
        description="Controls the navigation layout style."
      >
        <VscDropdown
          value={navStyle}
          onChange={(v) => setNavStyle(v as 'sidebar' | 'top')}
          options={[
            { value: 'sidebar', label: 'sidebar', isDefault: true },
            { value: 'top', label: 'top' },
          ]}
        />
      </SettingItem>
    </div>
  );

  // Sidebar navigation (VSCode style)
  const sidebarNav = (
    <nav className="w-12 shrink-0 border-r border-border bg-card flex flex-col items-center pt-2">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id && !showSettings;
        return (
          <button
            key={id}
            onClick={() => { sound.click(); setActiveTab(id); setShowSettings(false); }}
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
      <div className="mt-auto mb-2">
        <button
          onClick={() => { sound.click(); setShowSettings(!showSettings); }}
          className={cn(
            "relative w-12 h-12 flex items-center justify-center transition-colors cursor-pointer outline-none",
            showSettings
              ? "text-primary"
              : "text-primary/40 hover:text-primary/70 dark:text-[#858585] dark:hover:text-primary/70"
          )}
          title="Settings"
        >
          {showSettings && (
            <span className="absolute inset-1.5 bg-[#DDDDE2] dark:bg-primary/20" style={{ borderRadius: '6px' }} />
          )}
          <Settings className="w-5 h-5 relative z-10" strokeWidth={1.5} />
        </button>
      </div>
    </nav>
  );

  // Top navigation (horizontal tabs)
  const topNav = (
    <nav className="flex items-center justify-between w-full">
      <div className="flex items-center gap-0.5 text-sm border border-border bg-card p-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id && !showSettings;
          return (
            <button
              key={id}
              onClick={() => { sound.click(); setActiveTab(id); setShowSettings(false); }}
              className={cn(
                "relative px-3 py-1.5 transition-all duration-150 outline-none flex items-center gap-2 text-xs tracking-wide cursor-pointer",
                isActive
                  ? "text-primary-foreground bg-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-3.5 h-3.5 -translate-y-px" />
              <span className="leading-none">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="hidden md:flex items-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
        <span className="tracking-wider text-[10px]">NAVIGATE</span>
        <Kbd className="text-[10px] min-w-[20px] h-5 flex items-center justify-center px-1.5 bg-card border border-border">Tab</Kbd>
      </div>
    </nav>
  );

  // Sidebar layout
  if (navStyle === 'sidebar') {
    return (
      <div className="h-screen bg-background text-foreground font-mono selection:bg-primary selection:text-primary-foreground relative overflow-hidden transition-colors duration-300 flex flex-col">
        <Toaster position="bottom-center" theme={theme} richColors />
        <div className="scanline" />
        <div className="w-full flex-1 flex relative z-10 min-h-0">
          {sidebarNav}
          <div className="flex-1 flex flex-col min-h-0">
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
            <main className="flex-1 p-6 overflow-auto">
              <h2 className="text-sm font-bold text-primary mb-4">
                {showSettings ? 'SETTINGS' : tabs.find(t => t.id === activeTab)?.label}
              </h2>
              {showSettings ? settingsContent : (
                <>
                  {activeTab === 'keys' && <KeyList />}
                  {activeTab === 'commands' && <CommandsManager />}
                  {activeTab === 'skills' && <SkillsManager />}
                  {activeTab === 'droids' && <DroidsManager />}
                  {activeTab === 'mcp' && <McpManager />}
                </>
              )}
            </main>
          </div>
        </div>
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
            
            <button
              onClick={() => { sound.click(); setNavStyle('top'); }}
              className="hover:opacity-80 cursor-pointer"
            >
              Nav: Side
            </button>
          </span>
          <a href="https://github.com/notdp/oroio" target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
            <Github className="w-3 h-3" />
          </a>
        </footer>
      </div>
    );
  }

  // Classic layout
  return (
    <div className="h-screen bg-background text-foreground font-mono selection:bg-primary selection:text-primary-foreground relative overflow-hidden transition-colors duration-300 flex flex-col">
      <Toaster position="bottom-center" theme={theme} richColors />
      <div className="scanline" />
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col p-4 md:p-8 pb-0 relative z-10 min-h-0">
        <header className="border-b border-border pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              <span className="font-pixel text-lg tracking-tighter mt-0.5 text-primary leading-none">OROIO</span>
            </h1>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex h-7 items-center border border-border bg-card divide-x divide-border">
                <button
                  onClick={() => { sound.click(); setShowSettings(!showSettings); }}
                  className={cn(
                    "flex items-center justify-center w-9 h-full transition-colors cursor-pointer",
                    showSettings
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
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
        <div className="mt-8 shrink-0">{topNav}</div>
        <main className="border border-border bg-card p-6 flex-1 relative overflow-auto mt-8">
          {showSettings ? settingsContent : (
            <>
              {activeTab === 'keys' && <KeyList />}
              {activeTab === 'commands' && <CommandsManager />}
              {activeTab === 'skills' && <SkillsManager />}
              {activeTab === 'droids' && <DroidsManager />}
              {activeTab === 'mcp' && <McpManager />}
            </>
          )}
        </main>
      </div>
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
          
          <button
            onClick={() => { sound.click(); setNavStyle('sidebar'); }}
            className="hover:opacity-80 cursor-pointer"
          >
            Nav: Top
          </button>
        </span>
        <a href="https://github.com/notdp/oroio" target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
          <Github className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
}
