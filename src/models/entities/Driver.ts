import { v4 as uuidv4 } from 'uuid';

export interface DriverJSON {
  id: string;
  fullName: string;
  weeklyHours: number;
  availableDays: string[];
  preferredShifts: ShiftType[];
  shiftsToAvoid: ShiftType[];
  unavailableDates: string[];
}

export enum ShiftType {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  NIGHT = 'night',
}

export class Driver {
  public id: string;
  public fullName: string;
  public weeklyHours: number;
  public availableDays: string[] = []; // Empty means all days available
  public preferredShifts: ShiftType[] = [];
  public shiftsToAvoid: ShiftType[] = [];
  public unavailableDates: Date[] = [];

  constructor(
    fullName: string,
    weeklyHours: number,
    preferredShifts: ShiftType[] = [],
    shiftsToAvoid: ShiftType[] = [],
    availableDays: string[] = [],
    id?: string
  ) {
    this.id = id || uuidv4();
    this.fullName = fullName;
    this.weeklyHours = weeklyHours;
    this.preferredShifts = preferredShifts;
    this.shiftsToAvoid = shiftsToAvoid;
    this.availableDays = availableDays;
  }

  public isAvailableOnDate(date: Date): boolean {
    const dateString = date.toISOString().split('T')[0];

    // Check if date is in unavailable dates
    if (
      this.unavailableDates.some(
        unavailableDate =>
          unavailableDate.toISOString().split('T')[0] === dateString
      )
    ) {
      return false;
    }

    // If availableDays is empty, driver is available on all days
    if (this.availableDays.length === 0) {
      return true;
    }

    // Check if day of week is in available days
    const dayOfWeek = date
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    return this.availableDays.includes(dayOfWeek);
  }

  public hasShiftPreference(shift: ShiftType): boolean {
    return this.preferredShifts.includes(shift);
  }

  public avoidsShift(shift: ShiftType): boolean {
    return this.shiftsToAvoid.includes(shift);
  }

  public markUnavailable(date: Date): void {
    if (!this.isAvailableOnDate(date)) return;
    this.unavailableDates.push(new Date(date));
  }

  public markAvailable(date: Date): void {
    const dateString = date.toISOString().split('T')[0];
    this.unavailableDates = this.unavailableDates.filter(
      unavailableDate =>
        unavailableDate.toISOString().split('T')[0] !== dateString
    );
  }

  public toJSON(): DriverJSON {
    return {
      id: this.id,
      fullName: this.fullName,
      weeklyHours: this.weeklyHours,
      availableDays: this.availableDays,
      preferredShifts: this.preferredShifts,
      shiftsToAvoid: this.shiftsToAvoid,
      unavailableDates: this.unavailableDates.map(date => date.toISOString()),
    };
  }

  public static fromJSON(json: DriverJSON): Driver {
    const driver = new Driver(
      json.fullName,
      json.weeklyHours,
      json.preferredShifts,
      json.shiftsToAvoid,
      json.availableDays,
      json.id
    );

    driver.unavailableDates = (json.unavailableDates || []).map(
      dateStr => new Date(dateStr)
    );

    return driver;
  }
}
