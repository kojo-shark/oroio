import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Trash2, FileText, FolderOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog";
import { isElectron, listSkills, createSkill, deleteSkill, type Skill } from '@/utils/api';

export default function SkillsManager() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listSkills();
      setSkills(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;
    setAdding(true);
    try {
      await createSkill(newSkillName.trim());
      setNewSkillName('');
      setAddDialogOpen(false);
      await loadSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create skill');
    }
    setAdding(false);
  };

  const handleDeleteSkill = async () => {
    if (!skillToDelete) return;
    try {
      await deleteSkill(skillToDelete);
      await loadSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete skill');
    }
    setSkillToDelete(null);
  };

  const handleOpenSkill = async (skillPath: string) => {
    if (isElectron) {
      await window.oroio.openPath(skillPath);
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
        <Button onClick={loadSkills}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 md:gap-4">
          <div className="px-4 py-2 border border-border bg-card/50 min-w-[140px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Total Skills</div>
            <div className="text-xl font-bold font-mono text-primary">
              {skills.length.toString().padStart(2, '0')} <span className="text-[10px] text-muted-foreground font-normal">ITEMS</span>
            </div>
          </div>

          <div className="px-4 py-2 border border-border bg-card/50 min-w-[140px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Format</div>
            <div className="text-xl font-bold font-mono text-primary">
              .MD <span className="text-[10px] text-muted-foreground font-normal">TEXT</span>
            </div>
          </div>

          <div className="px-4 py-2 border border-border bg-card/50 min-w-[140px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Expansion</div>
            <div className="text-xl font-bold font-mono text-foreground">
              AUTO <span className="text-[10px] text-muted-foreground font-normal">ON</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={loadSkills}>
            <RefreshCw className="h-4 w-4 mr-2" />
            REFRESH
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                NEW SKILL
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Skill</DialogTitle>
                <DialogDescription>Enter a name for your new skill. A SKILL.md file will be created.</DialogDescription>
              </DialogHeader>
              <Input
                placeholder="my-skill"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSkill} disabled={adding || !newSkillName.trim()}>
                  {adding ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-50" />
            <p>No skills found</p>
            <p className="text-sm">Create skills in .factory/skills/[name]/SKILL.md</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skills.map((skill) => (
                <TableRow key={skill.name}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{skill.path}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenSkill(skill.path)}
                        title="Open in Editor"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenSkill(skill.path.replace('/SKILL.md', ''))}
                        title="Open Folder"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setSkillToDelete(skill.name)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={skillToDelete !== null} onOpenChange={(open) => !open && setSkillToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete skill "{skillToDelete}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the skill folder and all its contents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSkill} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
