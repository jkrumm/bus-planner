import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  FileJson,
  Trash2,
  RotateCcw,
  History,
} from 'lucide-react';

import type { Backup } from '@/services/PlanningService';
import {
  useGetBackups,
  useCreateBackup,
  useRestoreBackup,
  useLoadSampleData,
  useResetData,
} from '@/api/queries/backups';

export function DataPage() {
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Fetch backups with React Query
  const {
    data: backups = [],
    isLoading: isBackupsLoading,
    error: backupsError,
    refetch: refetchBackups,
  } = useGetBackups();

  // Create backup mutation
  const createBackupMutation = useCreateBackup();

  // Add success/error handlers for createBackupMutation
  const handleCreateBackupSuccess = () => {
    setMessage({
      type: 'success',
      text: 'Backup wurde erfolgreich erstellt.',
    });
  };

  const handleCreateBackupError = (error: Error) => {
    setMessage({
      type: 'error',
      text: `Fehler beim Erstellen des Backups: ${error}`,
    });
  };

  // Restore backup mutation
  const restoreBackupMutation = useRestoreBackup();

  // Add success/error/settled handlers for restoreBackupMutation
  const handleRestoreBackupSuccess = () => {
    setMessage({
      type: 'success',
      text: 'Backup wurde erfolgreich wiederhergestellt.',
    });
    // The page will be reloaded by the hook's onSuccess callback
  };

  const handleRestoreBackupError = (error: Error) => {
    setMessage({
      type: 'error',
      text: `Fehler beim Wiederherstellen des Backups: ${error}`,
    });
    // Dialog will be closed by onSettled callback
  };

  // Load sample data mutation
  const loadSampleDataMutation = useLoadSampleData();

  // Add success/error/settled handlers for loadSampleDataMutation
  const handleLoadSampleDataSuccess = () => {
    setMessage({
      type: 'success',
      text: 'Beispieldaten wurden erfolgreich geladen.',
    });
    // Reload the page to reflect the changes
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleLoadSampleDataError = (error: Error) => {
    setMessage({
      type: 'error',
      text: `Fehler beim Laden der Beispieldaten: ${error}`,
    });
    // Dialog will be closed by onSettled callback
  };

  // Reset data mutation
  const resetDataMutation = useResetData();

  // Add success/error/settled handlers for resetDataMutation
  const handleResetDataSuccess = () => {
    setMessage({
      type: 'success',
      text: 'Daten wurden erfolgreich zurückgesetzt.',
    });
    // Reload the page to reflect the changes
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleResetDataError = (error: Error) => {
    setMessage({
      type: 'error',
      text: `Fehler beim Zurücksetzen der Daten: ${error}`,
    });
    // Dialog will be closed by onSettled callback
  };

  // Combined loading state
  const isLoading =
    isBackupsLoading ||
    createBackupMutation.isPending ||
    restoreBackupMutation.isPending ||
    loadSampleDataMutation.isPending ||
    resetDataMutation.isPending;

  return (
    <div className="container p-6">
      <h1 className="text-2xl font-bold mb-6">Datenstand</h1>

      {message.text && (
        <div
          className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          <div className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5" />
            <span>{message.text}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              <span>Beispieldaten laden</span>
            </CardTitle>
            <CardDescription>
              Lädt vordefinierte Beispieldaten für Busse, Fahrer und Linien.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Diese Aktion wird alle vorhandenen Daten überschreiben und durch
              Beispieldaten ersetzen. Dies umfasst alle Busse, Fahrer, Linien
              und Zuweisungen.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => setIsLoadDialogOpen(true)}
              variant="secondary"
              disabled={isLoading}
              className="cursor-pointer"
            >
              Beispieldaten laden
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              <span>Daten zurücksetzen</span>
            </CardTitle>
            <CardDescription>
              Setzt alle Daten auf den Ausgangszustand zurück.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Diese Aktion wird alle vorhandenen Daten löschen. Nach dem
              Zurücksetzen sind keine Busse, Fahrer, Linien oder Zuweisungen
              mehr vorhanden.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => setIsResetDialogOpen(true)}
              variant="destructive"
              disabled={isLoading}
              className="cursor-pointer"
            >
              Daten zurücksetzen
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <span>Backup-Historie</span>
            </CardTitle>
            <CardDescription>
              Frühere Datenstände wiederherstellen und verwalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {backups.length === 0 ? (
              <p>Keine Backups verfügbar.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum und Uhrzeit</TableHead>
                    <TableHead>Dateiname</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map(backup => (
                    <TableRow key={backup.filename}>
                      <TableCell>{backup.displayDate}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {backup.filename}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup);
                            setIsRestoreDialogOpen(true);
                          }}
                          className="flex items-center gap-1 my-1 ml-auto"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Wiederherstellen
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <p className="text-sm text-muted-foreground">
              {backups.length} Backups verfügbar
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  createBackupMutation.mutate(undefined, {
                    onSuccess: handleCreateBackupSuccess,
                    onError: handleCreateBackupError,
                  });
                }}
                disabled={isLoading}
              >
                {createBackupMutation.isPending
                  ? 'Wird erstellt...'
                  : 'Backup erstellen'}
              </Button>
              <Button
                variant="outline"
                onClick={() => refetchBackups()}
                disabled={isLoading}
              >
                {isBackupsLoading ? 'Wird aktualisiert...' : 'Aktualisieren'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Load Sample Data Confirmation Dialog */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beispieldaten laden</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie die Beispieldaten laden möchten? Diese
              Aktion wird alle vorhandenen Daten überschreiben.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Abbrechen
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                loadSampleDataMutation.mutate(undefined, {
                  onSuccess: handleLoadSampleDataSuccess,
                  onError: handleLoadSampleDataError,
                  onSettled: () => setIsLoadDialogOpen(false),
                });
              }}
              disabled={isLoading}
            >
              {loadSampleDataMutation.isPending
                ? 'Wird geladen...'
                : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Data Confirmation Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daten zurücksetzen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie alle Daten zurücksetzen möchten? Diese
              Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Abbrechen
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                resetDataMutation.mutate(undefined, {
                  onSuccess: handleResetDataSuccess,
                  onError: handleResetDataError,
                  onSettled: () => setIsResetDialogOpen(false),
                });
              }}
              disabled={isLoading}
            >
              {resetDataMutation.isPending
                ? 'Wird zurückgesetzt...'
                : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Backup Confirmation Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backup wiederherstellen</DialogTitle>
            <DialogDescription>
              {selectedBackup && (
                <>
                  Sind Sie sicher, dass Sie das Backup vom{' '}
                  {selectedBackup.displayDate} wiederherstellen möchten? Diese
                  Aktion wird alle aktuellen Daten überschreiben.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Abbrechen
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (selectedBackup) {
                  restoreBackupMutation.mutate(selectedBackup.filename, {
                    onSuccess: handleRestoreBackupSuccess,
                    onError: handleRestoreBackupError,
                    onSettled: () => setIsRestoreDialogOpen(false),
                  });
                }
              }}
              disabled={isLoading || !selectedBackup}
            >
              {restoreBackupMutation.isPending
                ? 'Wird wiederhergestellt...'
                : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
