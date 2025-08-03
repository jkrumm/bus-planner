import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ASSIGNMENTS_API } from '../apiConfig';
import { Assignment } from '@/models/entities/Assignment';
import { ShiftType } from '@/models/entities/Driver';
import { queryKeys } from '../queryKeys';

// Get all assignments
export const useGetAssignments = () => {
  return useQuery({
    queryKey: queryKeys.assignments.all,
    queryFn: async () => {
      const response = await fetch(ASSIGNMENTS_API.GET_ALL);
      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }
      return response.json();
    },
  });
};

// Get a single assignment by ID
export const useGetAssignment = (id?: string) => {
  return useQuery({
    queryKey: queryKeys.assignments.details(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(ASSIGNMENTS_API.GET_ONE(id));
      if (!response.ok) {
        throw new Error('Failed to fetch assignment');
      }
      return response.json();
    },
    enabled: !!id,
  });
};

// Get assignments by date
export const useGetAssignmentsByDate = (date?: string) => {
  return useQuery({
    queryKey: queryKeys.assignments.byDate(date || ''),
    queryFn: async () => {
      if (!date) return [];
      const response = await fetch(ASSIGNMENTS_API.GET_BY_DATE(date));
      if (!response.ok) {
        throw new Error('Failed to fetch assignments by date');
      }
      return (await response.json()) as Assignment[];
    },
    enabled: !!date,
  });
};

// Create assignment mutation
interface CreateAssignmentData {
  date: string;
  shift: ShiftType;
  lineId: string;
  busId: string;
  driverId: string;
}

export const useCreateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAssignmentData) => {
      const response = await fetch(ASSIGNMENTS_API.CREATE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create assignment');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate queries that might be affected by this mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });

      // Extract the date from the variables to invalidate date-specific queries
      const dateStr = new Date(variables.date).toISOString().split('T')[0];
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byDate(dateStr),
      });
    },
  });
};

// Delete assignment mutation
export const useDeleteAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(ASSIGNMENTS_API.DELETE(id), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete assignment');
      }

      return response.status === 200;
    },
    onSuccess: (_, id) => {
      // Invalidate all assignment queries
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.details(id),
      });

      // Since we don't know the date of the deleted assignment here,
      // we could either store it in a variable before deletion
      // or simply invalidate all date-based queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 queryKey.length > 0 && 
                 queryKey[0] === 'assignments' && 
                 queryKey[1] === 'date';
        },
      });
    },
  });
};
