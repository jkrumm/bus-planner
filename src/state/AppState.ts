import { Bus } from '../models/entities/Bus.js';
import { Driver } from '../models/entities/Driver.js';
import {
  Line,
  type TimeSchedule,
  type WeeklySchedule,
} from '../models/entities/Line.js';
import { Assignment } from '../models/entities/Assignment.js';
import { ShiftType } from '../models/entities/Driver.js';

export interface AppStateData {
  buses: ReturnType<Bus['toJSON']>[];
  drivers: ReturnType<Driver['toJSON']>[];
  lines: ReturnType<Line['toJSON']>[];
  assignments: ReturnType<Assignment['toJSON']>[];
  metadata: {
    version: string;
    lastSaved: string;
    created: string;
  };
}

export interface DailyPlanningStatus {
  date: string; // ISO date string
  totalShifts: number;
  assignedShifts: number;
  lines: LinePlanningStatus[];
}

export interface LinePlanningStatus {
  id: string;
  name: string;
  lineNumber: string;
  totalShifts: number;
  assignedShifts: number;
}

export class AppState {
  private buses: Map<string, Bus> = new Map();
  private drivers: Map<string, Driver> = new Map();
  private lines: Map<string, Line> = new Map();
  private assignments: Map<string, Assignment> = new Map();

  private readonly dataFile: string;

  private onDataChangeCallback?: () => void;

  public get dataFilePath(): string {
    return this.dataFile;
  }

  public metadata = {
    version: '1.0.0',
    lastSaved: new Date().toISOString(),
    created: new Date().toISOString(),
  };

  constructor(dataFile: string = './data/bus-planner.json') {
    this.dataFile = dataFile;
  }

  // === LOADING & SAVING ===

  async load(): Promise<void> {
    return this.loadFromFile(this.dataFile);
  }

  private async loadFromFile(filePath: string): Promise<void> {
    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        console.log('No existing data file found, starting with empty state');
        return;
      }

      const content = await file.text();
      const data: AppStateData = JSON.parse(content);

      // Load buses
      this.buses.clear();
      for (const busData of data.buses || []) {
        const bus = Bus.fromJSON(busData);
        this.buses.set(bus.id, bus);
      }

      // Load drivers
      this.drivers.clear();
      for (const driverData of data.drivers || []) {
        const driver = Driver.fromJSON(driverData);
        this.drivers.set(driver.id, driver);
      }

      // Load lines
      this.lines.clear();
      for (const lineData of data.lines || []) {
        const line = Line.fromJSON(lineData);
        this.lines.set(line.id, line);
      }

      // Load assignments
      this.assignments.clear();
      for (const assignmentData of data.assignments || []) {
        const assignment = Assignment.fromJSON(assignmentData);
        this.assignments.set(assignment.id, assignment);
      }

      this.metadata = data.metadata || this.metadata;
      console.log(
        `Loaded ${this.buses.size} buses, ${this.drivers.size} drivers, ${this.lines.size} lines, ${this.assignments.size} assignments`
      );
    } catch (error) {
      console.error('Error loading data:', error);
      throw new Error('Failed to load application data');
    }
  }

  // Add this method
  setOnDataChangeCallback(callback: () => void): void {
    this.onDataChangeCallback = callback;
  }

  async save(skipBackup: boolean = false): Promise<void> {
    try {
      const dataDir = this.dataFile.substring(
        0,
        this.dataFile.lastIndexOf('/')
      );
      await Bun.write(`${dataDir}/.keep`, '');

      this.metadata.lastSaved = new Date().toISOString();

      const data: AppStateData = {
        buses: Array.from(this.buses.values()).map(bus => bus.toJSON()),
        drivers: Array.from(this.drivers.values()).map(driver =>
          driver.toJSON()
        ),
        lines: Array.from(this.lines.values()).map(line => line.toJSON()),
        assignments: Array.from(this.assignments.values()).map(assignment =>
          assignment.toJSON()
        ),
        metadata: this.metadata,
      };

      await Bun.write(this.dataFile, JSON.stringify(data, null, 2));
      console.log('Data saved successfully');

      // Call the callback when data is saved (but not during backup operations)
      if (this.onDataChangeCallback && !skipBackup) {
        this.onDataChangeCallback();
      }

      if (!skipBackup) {
        await this.backup();
      }
    } catch (error) {
      console.error('Error saving data:', error);
      throw new Error('Failed to save application data');
    }
  }

  async backup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup-${timestamp}.json`;
    const backupDir = './data/backups';
    const backupPath = `${backupDir}/${backupFilename}`;

    try {
      await Bun.write(`${backupDir}/.gitkeep`, '');
      await this.save(true); // Save without backup to avoid recursion

      const currentFile = Bun.file(this.dataFile);
      if (await currentFile.exists()) {
        const content = await currentFile.text();
        await Bun.write(backupPath, content);
        console.log(`Backup created: ${backupPath}`);
        return backupFilename;
      }
    } catch (error) {
      console.error('Error creating backup:', error);
    }
    return '';
  }

  async loadFromBackup(backupPath: string): Promise<void> {
    await this.loadFromFile(backupPath);
    await this.save(true); // Save without backup
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    await this.loadFromBackup(backupPath);
  }

  // === BUS OPERATIONS ===

  async createBus(bus: Bus): Promise<Bus> {
    this.buses.set(bus.id, bus);
    await this.save();
    return bus;
  }

  getBus(id: string): Bus | null {
    return this.buses.get(id) || null;
  }

  getAllBuses(): Bus[] {
    return Array.from(this.buses.values());
  }

  async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | null> {
    const existing = this.buses.get(id);
    if (!existing) return null;

    const existingData = existing.toJSON();
    const updatesData: Partial<typeof existingData> = {};

    Object.keys(updates).forEach(key => {
      const typedKey = key as keyof typeof updates;
      const value = updates[typedKey];

      if (key === 'unavailableDates' && Array.isArray(value)) {
        updatesData.unavailableDates = value.map(date =>
          date instanceof Date ? date.toISOString() : date
        );
      } else {
        (updatesData as any)[key] = value;
      }
    });

    const updatedBusData = { ...existingData, ...updatesData };
    const updatedBus = Bus.fromJSON(updatedBusData);

    this.buses.set(id, updatedBus);
    await this.save();
    return updatedBus;
  }

  async deleteBus(id: string): Promise<boolean> {
    const deleted = this.buses.delete(id);
    if (deleted) {
      this.removeAssignmentsByBus(id);
      await this.save();
    }
    return deleted;
  }

  getBusByLicensePlate(licensePlate: string): Bus | null {
    return (
      this.getAllBuses().find(bus => bus.licensePlate === licensePlate) || null
    );
  }

  getAvailableBuses(date: Date): Bus[] {
    return this.getAllBuses().filter(bus => bus.isAvailableOnDate(date));
  }

  // === DRIVER OPERATIONS ===

  async createDriver(driver: Driver): Promise<Driver> {
    this.drivers.set(driver.id, driver);
    await this.save();
    return driver;
  }

  getDriver(id: string): Driver | null {
    return this.drivers.get(id) || null;
  }

  getAllDrivers(): Driver[] {
    return Array.from(this.drivers.values());
  }

  async updateDriver(
    id: string,
    updates: Partial<Driver>
  ): Promise<Driver | null> {
    const existing = this.drivers.get(id);
    if (!existing) return null;

    const existingData = existing.toJSON();
    const updatesData: Partial<typeof existingData> = {};

    Object.keys(updates).forEach(key => {
      const typedKey = key as keyof typeof updates;
      const value = updates[typedKey];

      if (key === 'unavailableDates' && Array.isArray(value)) {
        updatesData.unavailableDates = value.map(date =>
          date instanceof Date ? date.toISOString() : date
        );
      } else if (key in existingData) {
        (updatesData as any)[key] = value;
      }
    });

    const updatedDriverData = { ...existingData, ...updatesData };
    const updatedDriver = Driver.fromJSON(updatedDriverData);

    this.drivers.set(id, updatedDriver);
    await this.save();
    return updatedDriver;
  }

  async deleteDriver(id: string): Promise<boolean> {
    const deleted = this.drivers.delete(id);
    if (deleted) {
      this.removeAssignmentsByDriver(id);
      await this.save();
    }
    return deleted;
  }

  getAvailableDrivers(date: Date): Driver[] {
    return this.getAllDrivers().filter(driver =>
      driver.isAvailableOnDate(date)
    );
  }

  // === LINE OPERATIONS ===

  async createLine(line: Line): Promise<Line> {
    this.lines.set(line.id, line);
    await this.save();
    return line;
  }

  getLine(id: string): Line | null {
    return this.lines.get(id) || null;
  }

  getAllLines(): Line[] {
    return Array.from(this.lines.values());
  }

  async updateLine(id: string, updates: Partial<Line>): Promise<Line | null> {
    const existing = this.lines.get(id);
    if (!existing) return null;

    const existingData = existing.toJSON();
    const updatedLineData = { ...existingData, ...updates };
    const updatedLine = Line.fromJSON(updatedLineData);

    this.lines.set(id, updatedLine);
    await this.save();
    return updatedLine;
  }

  async deleteLine(id: string): Promise<boolean> {
    const deleted = this.lines.delete(id);
    if (deleted) {
      this.removeAssignmentsByLine(id);
      await this.save();
    }
    return deleted;
  }

  getLineByNumber(lineNumber: string): Line | null {
    return (
      this.getAllLines().find(line => line.lineNumber === lineNumber) || null
    );
  }

  getActiveLines(): Line[] {
    return this.getAllLines().filter(line => line.isActive);
  }

  getLinesOperatingOnDate(date: Date): Line[] {
    return this.getAllLines().filter(line => line.operatesOnDate(date));
  }

  // === ASSIGNMENT OPERATIONS ===

  async createAssignment(assignment: Assignment): Promise<Assignment> {
    this.assignments.set(assignment.id, assignment);
    await this.save();
    return assignment;
  }

  getAssignment(id: string): Assignment | null {
    return this.assignments.get(id) || null;
  }

  getAllAssignments(): Assignment[] {
    return Array.from(this.assignments.values());
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const deleted = this.assignments.delete(id);
    if (deleted) {
      await this.save();
    }
    return deleted;
  }

  getAssignmentsByDate(date: Date): Assignment[] {
    const dateKey = date.toISOString().split('T')[0];
    return this.getAllAssignments().filter(
      assignment => assignment.getDateKey() === dateKey
    );
  }

  getAssignmentsByDateRange(startDate: Date, endDate: Date): Assignment[] {
    const startKey = startDate.toISOString().split('T')[0]!;
    const endKey = endDate.toISOString().split('T')[0]!;

    return this.getAllAssignments().filter(assignment => {
      const assignmentKey = assignment.getDateKey();
      return assignmentKey >= startKey && assignmentKey <= endKey;
    });
  }

  getAssignmentsByShift(date: Date, shift: ShiftType): Assignment[] {
    return this.getAssignmentsByDate(date).filter(
      assignment => assignment.shift === shift
    );
  }

  getConflicts(
    date: Date,
    shift: ShiftType,
    busId?: string,
    driverId?: string
  ): Assignment[] {
    const shiftAssignments = this.getAssignmentsByShift(date, shift);

    return shiftAssignments.filter(assignment => {
      if (busId && assignment.busId === busId) return true;
      if (driverId && assignment.driverId === driverId) return true;
      return false;
    });
  }

  private removeAssignmentsByBus(busId: string): void {
    const toRemove = this.getAllAssignments().filter(a => a.busId === busId);
    toRemove.forEach(assignment => this.assignments.delete(assignment.id));
  }

  private removeAssignmentsByDriver(driverId: string): void {
    const toRemove = this.getAllAssignments().filter(
      a => a.driverId === driverId
    );
    toRemove.forEach(assignment => this.assignments.delete(assignment.id));
  }

  private removeAssignmentsByLine(lineId: string): void {
    const toRemove = this.getAllAssignments().filter(a => a.lineId === lineId);
    toRemove.forEach(assignment => this.assignments.delete(assignment.id));
  }

  // === STATS ===

  getStats() {
    return {
      buses: this.buses.size,
      drivers: this.drivers.size,
      lines: this.lines.size,
      assignments: this.assignments.size,
      lastSaved: this.metadata.lastSaved,
    };
  }

  getPlanningStatus(): DailyPlanningStatus[] {
    console.log('getPlanningStatus');

    const statusMap = new Map<string, DailyPlanningStatus>();
    const allLines = this.getAllLines();
    const allAssignments = this.getAllAssignments();

    // Get current date
    const today = new Date();

    // Calculate the start of the current week (Monday)
    const currentDay = today.getDay();
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Adjust for Sunday

    // Get start date (2 weeks ago, starting from the beginning of that week)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToMonday - 2 * 7); // Go back 2 full weeks from current week's Monday

    // Get end date (6 weeks ahead, ending at the end of that week)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 8 * 7 - 1); // 8 weeks total (2 past + current + 6 future) minus 1 day

    // Initialize status for each day
    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      const dateStr = date.toISOString().split('T')[0]!;
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

      const linesOperatingToday = allLines.filter(
        line => line.isActive && line.operatesOnDate(date)
      );

      let totalDayShifts = 0;
      const lineStatuses: LinePlanningStatus[] = [];

      for (const line of linesOperatingToday) {
        const lineShifts = this.calculateRequiredShiftsForLine(line, dayOfWeek);
        totalDayShifts += lineShifts;

        const assignedShiftsForLine = allAssignments.filter(
          assignment =>
            assignment.lineId === line.id && assignment.getDateKey() === dateStr
        ).length;

        lineStatuses.push({
          id: line.id,
          name: line.routeName,
          lineNumber: line.lineNumber,
          totalShifts: lineShifts,
          assignedShifts: assignedShiftsForLine,
        });
      }

      const totalAssignedShifts = allAssignments.filter(
        assignment => assignment.getDateKey() === dateStr
      ).length;

      statusMap.set(dateStr, {
        date: dateStr,
        totalShifts: totalDayShifts,
        assignedShifts: totalAssignedShifts,
        lines: lineStatuses,
      });
    }

    // Get all planning status entries sorted by date
    const allStatusEntries = Array.from(statusMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Find the first Sunday (or whatever is considered the first day of week in your locale)
    // For JS Date, 0 = Sunday, 1 = Monday, etc.
    const firstSunday = new Date(startDate);
    const dayToSunday = firstSunday.getDay(); // Days to go back to get to Sunday
    firstSunday.setDate(firstSunday.getDate() - dayToSunday);

    // Find the last Saturday (completing the last week)
    const lastSaturday = new Date(endDate);
    const daysToSaturday = 6 - lastSaturday.getDay(); // Days to go forward to get to Saturday
    lastSaturday.setDate(lastSaturday.getDate() + daysToSaturday);

    // Filter entries to include only full weeks
    const firstSundayStr = firstSunday.toISOString().split('T')[0]!;
    const lastSaturdayStr = lastSaturday.toISOString().split('T')[0]!;

    const fullWeeksEntries = allStatusEntries.filter(
      entry => entry.date >= firstSundayStr && entry.date <= lastSaturdayStr
    );

    return fullWeeksEntries;
  }

  private calculateRequiredShiftsForLine(
    line: Line,
    dayOfWeek: number
  ): number {
    // Based on your domain model, each line has a weekly schedule
    // This method calculates how many shifts are needed for a specific line on a specific day
    // You'll need to implement this based on your Line entity structure

    // Map numeric day of week (0 = Sunday, 1 = Monday, etc.) to weeklySchedule keys
    const dayMap = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];

    const dayKey = dayMap[dayOfWeek] as keyof WeeklySchedule;

    // Assuming each active line needs coverage for each shift it operates
    // This is a simplified calculation - adjust based on your actual business logic
    const schedule: TimeSchedule | null = line.weeklySchedule[dayKey] ?? null;
    if (!schedule || !line.isActive) {
      return 0;
    }

    // Count how many shifts are needed based on operating hours
    // This is a simplified approach - you may need more complex logic
    let shiftsNeeded = 0;
    const startHour = parseInt(schedule.start.split(':')[0]!);
    const endHour = parseInt(schedule.end.split(':')[0]!);

    // Early shift: 5:00 - 13:00
    if (startHour <= 13 && endHour > 5) shiftsNeeded++;

    // Late shift: 13:00 - 21:00
    if (startHour <= 21 && endHour > 13) shiftsNeeded++;

    // Night shift: 21:00 - 5:00
    if (startHour <= 5 || endHour > 21) shiftsNeeded++;

    return shiftsNeeded;
  }
}
