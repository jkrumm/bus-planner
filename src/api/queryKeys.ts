/**
 * Centralized query keys for React Query
 * This file contains all the query keys used in the application
 * to make it easier to navigate and maintain the codebase.
 */

// Export a single queryKeys object that contains all query keys
export const queryKeys = {
  // Query keys for buses
  buses: {
    all: ['buses'] as const,
    details: (id: string) => ['bus', id] as const,
  },

  // Query keys for drivers
  drivers: {
    all: ['drivers'] as const,
    details: (id: string) => ['driver', id] as const,
  },

  // Query keys for lines (for future implementation)
  lines: {
    all: ['lines'] as const,
    details: (id: string) => ['line', id] as const,
  },

  // Query keys for assignments (for future implementation)
  assignments: {
    all: ['assignments'] as const,
    details: (id: string) => ['assignment', id] as const,
    byDate: (date: string) => ['assignments', 'date', date] as const,
  },

  // Query keys for backups
  backups: {
    all: ['backups'] as const,
    create: ['backups', 'create'] as const,
    restore: (filename: string) => ['backups', 'restore', filename] as const,
  },
};
