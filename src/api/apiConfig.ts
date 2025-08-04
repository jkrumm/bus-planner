// API configuration file
// This file contains all API endpoints used in the application

// Base API URL
export const API_BASE_URL = '/api';

// Buses endpoints
export const BUSES_API = {
  GET_ALL: `${API_BASE_URL}/buses`,
  GET_ONE: (id: string) => `${API_BASE_URL}/buses/${id}`,
  CREATE: `${API_BASE_URL}/buses`,
  UPDATE: (id: string) => `${API_BASE_URL}/buses/${id}`,
  DELETE: (id: string) => `${API_BASE_URL}/buses/${id}`,
};

// Drivers endpoints
export const DRIVERS_API = {
  GET_ALL: `${API_BASE_URL}/drivers`,
  GET_ONE: (id: string) => `${API_BASE_URL}/drivers/${id}`,
  CREATE: `${API_BASE_URL}/drivers`,
  UPDATE: (id: string) => `${API_BASE_URL}/drivers/${id}`,
  DELETE: (id: string) => `${API_BASE_URL}/drivers/${id}`,
};

// Lines endpoints
export const LINES_API = {
  GET_ALL: `${API_BASE_URL}/lines`,
  GET_ONE: (id: string) => `${API_BASE_URL}/lines/${id}`,
  CREATE: `${API_BASE_URL}/lines`,
  UPDATE: (id: string) => `${API_BASE_URL}/lines/${id}`,
  DELETE: (id: string) => `${API_BASE_URL}/lines/${id}`,
};

// Assignments endpoints
export const ASSIGNMENTS_API = {
  GET_ALL: `${API_BASE_URL}/assignments`,
  GET_ONE: (id: string) => `${API_BASE_URL}/assignments/${id}`,
  CREATE: `${API_BASE_URL}/assignments`,
  DELETE: (id: string) => `${API_BASE_URL}/assignments/${id}`,
  GET_BY_DATE: (date: string) => `${API_BASE_URL}/assignments/date/${date}`,
};

// Settings endpoints
export const SETTINGS_API = {
  LOAD_SAMPLE_DATA: `${API_BASE_URL}/settings/load-sample-data`,
  RESET_DATA: `${API_BASE_URL}/settings/reset-data`,
  BACKUP: `${API_BASE_URL}/settings/backup`,
  GET_BACKUPS: `${API_BASE_URL}/settings/backups`,
  GET_CURRENT_BACKUP: `${API_BASE_URL}/settings/current-backup`,
  RESTORE_BACKUP: (filename: string) =>
    `${API_BASE_URL}/settings/backups/restore/${filename}`,
};

// Stats endpoints
export const STATS_API = {
  GET_ALL: `${API_BASE_URL}/stats`,
  GET_PLANNING_STATUS: `${API_BASE_URL}/stats/planning-status`,
};
