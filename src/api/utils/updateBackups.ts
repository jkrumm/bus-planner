import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';

/**
 * Utility function to invalidate the backups query.
 * This can be called from any mutation that modifies data.
 */
export function invalidateBackups(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
}

/**
 * Utility function to update all relevant queries when a mutation is performed.
 * This is a convenience function that can be called from any mutation's onSuccess callback.
 *
 * @param queryClient The QueryClient instance
 * @param queryKey The query key to invalidate (in addition to backups)
 */
export function updateQueriesAfterMutation(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void {
  // Invalidate the specified query
  queryClient.invalidateQueries({ queryKey });

  // Always invalidate backups when data is modified
  invalidateBackups(queryClient);
}
