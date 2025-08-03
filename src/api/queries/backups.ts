import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { SETTINGS_API } from '@/api/apiConfig';

// Fetch all backups
export function useGetBackups() {
  return useQuery({
    queryKey: queryKeys.backups.all,
    queryFn: async () => {
      const response = await fetch(SETTINGS_API.GET_BACKUPS);
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();

      if (!data || !Array.isArray(data)) {
        console.error('Invalid backups data:', data);
        return [];
      }

      return data;
    }
  });
}

// Create a new backup
export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(SETTINGS_API.BACKUP, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fehler beim Erstellen des Backups: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the backups list
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    }
  });
}

// Restore a backup
export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (filename: string) => {
      console.log('Restoring backup:', filename);
      
      const response = await fetch(SETTINGS_API.RESTORE_BACKUP(filename), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = 'Fehler beim Wiederherstellen des Backups';
        try {
          const errorData = await response.json();
          errorMessage += `: ${errorData.message || response.statusText}`;
        } catch (e) {
          errorMessage += ` (Status: ${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response from server:', responseText);
        throw new Error('Server returned non-JSON response. Check server logs.');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to restore backup');
      }

      return result;
    },
    onSuccess: (data) => {
      console.log('Backup restored successfully:', data.message);
      // Invalidate all queries since restoring a backup affects all data
      queryClient.invalidateQueries();
      // Reload the page to reflect the changes
      window.location.reload();
    },
    onError: (error) => {
      console.error('Error restoring backup:', error);
    }
  });
}

// Load sample data
export function useLoadSampleData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(SETTINGS_API.LOAD_SAMPLE_DATA, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Laden der Beispieldaten');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to load sample data');
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate all queries since loading sample data affects all data
      queryClient.invalidateQueries();
      // Reload the page to reflect the changes after a short delay
      // This is handled by the component's onSuccess callback
    }
  });
}

// Reset data
export function useResetData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(SETTINGS_API.RESET_DATA, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Zurücksetzen der Daten');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to reset data');
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate all queries since resetting data affects all data
      queryClient.invalidateQueries();
      // Reload the page to reflect the changes after a short delay
      // This is handled by the component's onSuccess callback
    }
  });
}