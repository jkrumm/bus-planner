import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bus, BusSize, PropulsionType } from '@/models/entities/Bus';
import { queryKeys } from '@/api/queryKeys';
import { BUSES_API } from '@/api/apiConfig.ts';
import { Line } from '@/models/entities/Line.ts';

// Fetch all buses
export function useGetBuses() {
  return useQuery({
    queryKey: queryKeys.buses.all,
    queryFn: async () => {
      const response = await fetch(BUSES_API.GET_ALL);
      if (!response.ok) {
        throw new Error('Failed to fetch buses');
      }
      return ((await response.json()) as Bus[]).map(bus => Bus.fromJSON(bus));
    },
  });
}

// Fetch a single bus
export function useGetBus(id: string | undefined) {
  const defaultBus: Partial<Bus> = {
    licensePlate: '',
    size: BusSize.MEDIUM,
    propulsionType: PropulsionType.DIESEL,
    maxRangeKm: undefined,
    unavailableDates: [],
  };

  return useQuery({
    queryKey: id ? queryKeys.buses.details(id) : ['bus', 'new'],
    queryFn: async () => {
      if (!id || id === 'new') return defaultBus;

      const response = await fetch(BUSES_API.GET_ONE(id));
      if (!response.ok) {
        throw new Error('Fehler beim Abrufen des Busses');
      }

      const data = await response.json();

      // Convert unavailable dates strings back to Date objects
      if (data.unavailableDates && Array.isArray(data.unavailableDates)) {
        data.unavailableDates = data.unavailableDates
          .map((dateStr: string) => {
            try {
              const date = new Date(dateStr);
              // Validate the date is valid
              if (isNaN(date.getTime())) return null;
              return date;
            } catch (e) {
              console.error('Invalid date format:', dateStr);
              return null;
            }
          })
          .filter((date: Date | null) => date !== null);
      } else {
        // Ensure unavailableDates is at least an empty array
        data.unavailableDates = [];
      }

      return data;
    },
    enabled: !!id && id !== 'new',
  });
}

// Create a new bus
export function useCreateBus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Bus>) => {
      const response = await fetch(BUSES_API.CREATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Erstellen des Busses');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the buses list
      queryClient.invalidateQueries({ queryKey: queryKeys.buses.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}

// Update an existing bus
export function useUpdateBus(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Bus>) => {
      if (!id) throw new Error('No ID provided for update');

      const response = await fetch(BUSES_API.UPDATE(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren des Busses');
      }

      return response.json();
    },
    onSuccess: data => {
      // Update the cache for the individual bus
      if (id) {
        queryClient.setQueryData(queryKeys.buses.details(id), data);
      }
      // Invalidate and refetch the buses list
      queryClient.invalidateQueries({ queryKey: queryKeys.buses.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}

// Delete a bus
export function useDeleteBus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(BUSES_API.DELETE(id), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen des Busses');
      }
    },
    onSuccess: () => {
      // Invalidate and refetch the buses query
      queryClient.invalidateQueries({ queryKey: queryKeys.buses.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    },
  });
}
