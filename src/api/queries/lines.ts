import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Line, type LineJSON } from '@/models/entities/Line';
import { queryKeys } from '@/api/queryKeys';
import { LINES_API } from '@/api/apiConfig';

// Fetch all lines
export function useGetLines() {
  return useQuery({
    queryKey: queryKeys.lines.all,
    queryFn: async () => {
      const response = await fetch(LINES_API.GET_ALL);
      if (!response.ok) {
        throw new Error('Failed to fetch lines');
      }
      return ((await response.json()) as Line[]).map(line =>
        Line.fromJSON(line)
      );
    },
  });
}

// Fetch a single line
export function useGetLine(id: string | undefined) {
  const defaultLine: Line = new Line('', '', 0, 0, [], {}, true);

  return useQuery({
    queryKey: id ? queryKeys.lines.details(id) : ['line', 'new'],
    queryFn: async () => {
      if (!id || id === 'new') return defaultLine;

      const response = await fetch(LINES_API.GET_ONE(id));
      if (!response.ok) {
        throw new Error('Fehler beim Abrufen der Linie');
      }

      return Line.fromJSON((await response.json()) as LineJSON);
    },
    enabled: !!id && id !== 'new',
  });
}

// Create a new line
export function useCreateLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Line>) => {
      const response = await fetch(LINES_API.CREATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Erstellen der Linie');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the lines list
      queryClient.invalidateQueries({ queryKey: queryKeys.lines.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}

// Update an existing line
export function useUpdateLine(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Line>) => {
      if (!id) throw new Error('No ID provided for update');

      const response = await fetch(LINES_API.UPDATE(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren der Linie');
      }

      return response.json();
    },
    onSuccess: data => {
      // Update the cache for the individual line
      if (id) {
        queryClient.setQueryData(queryKeys.lines.details(id), data);
      }
      // Invalidate and refetch the lines list
      queryClient.invalidateQueries({ queryKey: queryKeys.lines.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}

// Delete a line
export function useDeleteLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(LINES_API.DELETE(id), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen der Linie');
      }
    },
    onSuccess: () => {
      // Invalidate and refetch the lines query
      queryClient.invalidateQueries({ queryKey: queryKeys.lines.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}
