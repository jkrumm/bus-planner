import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { type Backup } from '@/services/PlanningService';
import { useGetBackups, useRestoreBackup } from '@/api/queries/backups';

export function BackupHistory() {
  const [currentBackupIndex, setCurrentBackupIndex] = useState<number>(0);

  // Fetch backups with React Query
  const {
    data: backups = [],
    isLoading: isBackupsLoading,
    error: backupsError,
  } = useGetBackups();

  // Set current backup index when data is loaded - use useEffect to avoid infinite re-renders
  useEffect(() => {
    if (backups.length > 0) {
      const index = backups.findIndex((b: Backup) => b.isCurrent === true);
      const newIndex = index >= 0 ? index : 0;
      if (currentBackupIndex !== newIndex) {
        setCurrentBackupIndex(newIndex);
      }
    }
  }, [backups, currentBackupIndex]);

  // Restore backup mutation
  const restoreBackupMutation = useRestoreBackup();

  const goToBackup = (index: number) => {
    if (index >= 0 && index < backups.length) {
      restoreBackupMutation.mutate(backups[index]!.filename);
      setCurrentBackupIndex(index);
    }
  };

  const goBack = () => {
    if (currentBackupIndex < backups.length - 1) {
      goToBackup(currentBackupIndex + 1);
    }
  };

  const goForward = () => {
    if (currentBackupIndex > 0) {
      goToBackup(currentBackupIndex - 1);
    }
  };

  // Combined loading state
  const isLoading = isBackupsLoading || restoreBackupMutation.isPending;

  if (backups.length === 0) {
    return null;
  }

  const currentBackup = backups[currentBackupIndex];
  const isNewest = currentBackupIndex === 0;
  const isOldest = currentBackupIndex === backups.length - 1;

  return (
    <div className="flex items-center gap-1 ml-auto mr-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={goBack}
        disabled={isOldest || isLoading}
        className="h-8 w-8"
        title="Zu älterem Backup"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 h-8"
            disabled={isLoading}
          >
            <History className="h-3.5 w-3.5" />
            {isNewest ? (
              <span className="text-xs">Auf neuestem Stand</span>
            ) : (
              <span className="text-xs">
                Backup: {currentBackup?.displayDate || ''}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 max-w-[250px]" align="center">
          <div className="p-2">
            <h3 className="font-medium text-sm px-2 py-1.5">Backup-Historie</h3>
            <div className="max-h-[300px] overflow-y-auto">
              {backups.map((backup, index) => (
                <Button
                  key={backup.filename}
                  variant={index === currentBackupIndex ? 'default' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-xs mb-1"
                  onClick={() => goToBackup(index)}
                  disabled={isLoading}
                >
                  {index === 0 ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Neuester Stand {backup.isCurrent && '(aktiv)'}
                    </>
                  ) : (
                    <>
                      <History className="h-3 w-3 mr-2" />
                      Backup: {backup.displayDate}{' '}
                      {backup.isCurrent && '(aktiv)'}
                    </>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        onClick={goForward}
        disabled={isNewest || isLoading}
        className="h-8 w-8"
        title="Zu neuerem Backup"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
