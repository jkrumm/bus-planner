import { useQuery } from '@tanstack/react-query';
import { STATS_API } from '../apiConfig';
import { queryKeys } from '../queryKeys';
import type { DailyPlanningStatus } from '@/state/AppState.ts';

export const useGetStats = () => {
  return useQuery({
    queryKey: queryKeys.stats.all,
    queryFn: async () => {
      const response = await fetch(STATS_API.GET_ALL);
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    },
  });
};

export const useGetPlanningStatus = () => {
  return useQuery({
    queryKey: queryKeys.stats.planningStatus,
    queryFn: async () => {
      const response = await fetch(STATS_API.GET_PLANNING_STATUS);
      if (!response.ok) {
        throw new Error('Failed to fetch planning status');
      }
      return (await response.json()) as DailyPlanningStatus[];
    },
  });
};
