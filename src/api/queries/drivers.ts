import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Driver, ShiftType } from '@/models/entities/Driver';
import { DRIVERS_API } from '@/api/apiConfig';
import { queryKeys } from '@/api/queryKeys';

// Fetch all drivers
export function useGetDrivers() {
  return useQuery({
    queryKey: queryKeys.drivers.all,
    queryFn: async () => {
      const response = await fetch(DRIVERS_API.GET_ALL);
      if (!response.ok) {
        throw new Error('Failed to fetch drivers');
      }
      return response.json();
    }
  });
}

// Fetch a single driver
export function useGetDriver(id: string | undefined) {
  const defaultDriver: Partial<Driver> = {
    fullName: '',
    weeklyHours: 40,
    availableDays: [],
    preferredShifts: [],
    shiftsToAvoid: [],
    unavailableDates: [],
  };

  return useQuery({
    queryKey: id ? queryKeys.drivers.details(id) : ['driver', 'new'],
    queryFn: async () => {
      if (!id || id === 'new') return defaultDriver;

      const response = await fetch(DRIVERS_API.GET_ONE(id));
      if (!response.ok) {
        throw new Error('Fehler beim Abrufen des Fahrers');
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

// Create a new driver
export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Driver>) => {
      // Create a copy of the driver data for submission
      const driverForSubmission = {
        ...data,
        // Ensure unavailable dates are properly converted to ISO strings
        unavailableDates: Array.isArray(data.unavailableDates)
          ? data.unavailableDates.map(date =>
              date instanceof Date ? date.toISOString() : date
            )
          : [],
      };

      const response = await fetch(DRIVERS_API.CREATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(driverForSubmission),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Erstellen des Fahrers');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the drivers list
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    }
  });
}

// Update an existing driver
export function useUpdateDriver(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Driver>) => {
      if (!id) throw new Error('No ID provided for update');

      // Create a copy of the driver data for submission
      const driverForSubmission = {
        ...data,
        // Ensure unavailable dates are properly converted to ISO strings
        unavailableDates: Array.isArray(data.unavailableDates)
          ? data.unavailableDates.map(date =>
              date instanceof Date ? date.toISOString() : date
            )
          : [],
      };

      const response = await fetch(DRIVERS_API.UPDATE(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(driverForSubmission),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren des Fahrers');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Update the cache for the individual driver
      if (id) {
        queryClient.setQueryData(queryKeys.drivers.details(id), data);
      }
      // Invalidate and refetch the drivers list
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    }
  });
}

// Delete a driver
export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(DRIVERS_API.DELETE(id), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen des Fahrers');
      }
    },
    onSuccess: () => {
      // Invalidate and refetch the drivers query
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      // Invalidate backups list since a modification was made
      queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
    }
  });
}
