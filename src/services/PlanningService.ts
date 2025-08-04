import { AppState } from '../state/AppState.js';
import * as fs from 'fs';
import * as path from 'path';
import { Assignment } from '../models/entities/Assignment.js';
import { ShiftType } from '../models/entities/Driver.js';
import { Bus } from '../models/entities/Bus.js';
import { Driver } from '../models/entities/Driver.js';
import { Line } from '../models/entities/Line.js';

export interface ConflictWarning {
  type:
    | 'double_booking'
    | 'bus_size_mismatch'
    | 'insufficient_range'
    | 'unavailable_resource'
    | 'preference_violation'
    | 'weekly_hours_exceeded';
  message: string;
  severity: 'warning' | 'error';
}

export interface AssignmentValidation {
  isValid: boolean;
  warnings: ConflictWarning[];
}

export interface Backup {
  filename: string;
  path: string;
  timestamp: Date;
  displayDate: string;
  isCurrent?: boolean;
}

export class PlanningService {
  public state: AppState;
  private currentBackupFilename: string | null = null;

  constructor(dataFile?: string) {
    this.state = new AppState(dataFile);

    // Set up the callback to clear backup tracking when data changes
    this.state.setOnDataChangeCallback(() => {
      this.currentBackupFilename = null;
    });
  }

  async initialize(): Promise<void> {
    await this.state.load();
  }

  async backup(): Promise<string> {
    return await this.state.backup();
  }

  async restoreBackup(backupFilename: string): Promise<boolean> {
    try {
      const backupDir = './data/backups';
      const backupPath = `${backupDir}/${backupFilename}`;

      const backupFile = Bun.file(backupPath);
      if (!(await backupFile.exists())) {
        console.error(`Backup file not found: ${backupPath}`);
        return false;
      }

      await this.state.restoreFromBackup(backupPath);

      // Track which backup is active
      this.currentBackupFilename = backupFilename;

      console.log(`Restored backup: ${backupPath}`);
      return true;
    } catch (error) {
      console.error(`Error restoring backup ${backupFilename}:`, error);
      return false;
    }
  }

  async resetData(): Promise<boolean> {
    try {
      this.state = new AppState(this.state.dataFilePath);
      await this.state.save();
      this.currentBackupFilename = null; // Clear backup tracking
      console.log('Data reset successfully');
      return true;
    } catch (error) {
      console.error('Error resetting data:', error);
      return false;
    }
  }

  async loadSampleData(): Promise<boolean> {
    try {
      const sampleDataFile = Bun.file('./data/sample-data.json');
      if (!(await sampleDataFile.exists())) {
        console.error('Sample data file not found');
        return false;
      }

      await this.state.loadFromBackup('./data/sample-data.json');
      this.currentBackupFilename = null; // Clear backup tracking
      console.log('Sample data loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading sample data:', error);
      return false;
    }
  }

  async getBackups(): Promise<Backup[]> {
    try {
      const backupDir = './data/backups';

      try {
        await fs.promises.access(backupDir);
      } catch (error) {
        console.log('Backups directory does not exist yet');
        return [];
      }

      const files = await fs.promises.readdir(backupDir);

      const backupFiles = files
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(filename => {
          const timestampStr = filename
            .replace('backup-', '')
            .replace('.json', '');
          const timestamp = new Date(
            timestampStr.replace(/-/g, (match, index) => {
              if (index === 13 || index === 16) return ':';
              if (index === 10) return 'T';
              if (index === 19) return '.';
              return match;
            })
          );

          return {
            filename,
            path: path.join(backupDir, filename),
            timestamp,
            displayDate: timestamp.toLocaleString('de-DE'),
            isCurrent: this.currentBackupFilename === filename,
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return backupFiles;
    } catch (error) {
      console.error('Error reading backups directory:', error);
      return [];
    }
  }

  async getCurrentBackupInfo(): Promise<Backup | null> {
    if (!this.currentBackupFilename) {
      return null; // We're on the latest state
    }

    const backups = await this.getBackups();
    const current = backups.find(
      b => b.filename === this.currentBackupFilename
    );
    return current || null;
  }

  async createAssignment(
    date: Date,
    shift: ShiftType,
    lineId: string,
    busId: string,
    driverId: string
  ): Promise<{ assignment?: Assignment; validation: AssignmentValidation }> {
    const validation = this.validateAssignment(
      date,
      shift,
      lineId,
      busId,
      driverId
    );
    const assignment = new Assignment(date, shift, lineId, busId, driverId);

    await this.state.createAssignment(assignment);
    this.currentBackupFilename = null; // Clear backup tracking when saving new data

    return { assignment, validation };
  }

  validateAssignment(
    date: Date,
    shift: ShiftType,
    lineId: string,
    busId: string,
    driverId: string
  ): AssignmentValidation {
    const warnings: ConflictWarning[] = [];

    const bus = this.state.getBus(busId);
    const driver = this.state.getDriver(driverId);
    const line = this.state.getLine(lineId);

    if (!bus || !driver || !line) {
      warnings.push({
        type: 'unavailable_resource',
        message: 'One or more resources not found',
        severity: 'error',
      });
      return { isValid: false, warnings };
    }

    // Check for double bookings
    const conflicts = this.state.getConflicts(date, shift, busId, driverId);
    if (conflicts.length > 0) {
      warnings.push({
        type: 'double_booking',
        message: 'Bus or driver already assigned to another line in this shift',
        severity: 'error',
      });
    }

    // Check bus availability
    if (!bus.isAvailableOnDate(date)) {
      warnings.push({
        type: 'unavailable_resource',
        message: 'Bus is not available on this date',
        severity: 'warning',
      });
    }

    // Check driver availability
    if (!driver.isAvailableOnDate(date)) {
      warnings.push({
        type: 'unavailable_resource',
        message: 'Driver is not available on this date',
        severity: 'warning',
      });
    }

    // Check bus size compatibility
    if (!line.isCompatibleWithBus(bus.size)) {
      warnings.push({
        type: 'bus_size_mismatch',
        message: 'Bus size is not compatible with this line',
        severity: 'warning',
      });
    }

    // Check electric bus range
    if (bus.isElectric() && !bus.canHandleDistance(line.distanceKm)) {
      warnings.push({
        type: 'insufficient_range',
        message: 'Electric bus does not have sufficient range for this line',
        severity: 'warning',
      });
    }

    // Check driver shift preferences
    if (driver.avoidsShift(shift)) {
      warnings.push({
        type: 'preference_violation',
        message: 'Driver prefers to avoid this shift',
        severity: 'warning',
      });
    }

    if (
      driver.preferredShifts.length > 0 &&
      !driver.hasShiftPreference(shift)
    ) {
      warnings.push({
        type: 'preference_violation',
        message: 'This shift is not among driver preferences',
        severity: 'warning',
      });
    }

    return {
      isValid: warnings.filter(w => w.severity === 'error').length === 0,
      warnings,
    };
  }
}
