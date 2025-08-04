import { Bus } from '../models/entities/Bus.js';
import { Driver } from '../models/entities/Driver.js';
import { Line } from '../models/entities/Line.js';
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

  // === HELPER METHODS ===

  getStats() {
    return {
      buses: this.buses.size,
      drivers: this.drivers.size,
      lines: this.lines.size,
      assignments: this.assignments.size,
      lastSaved: this.metadata.lastSaved,
    };
  }
}
