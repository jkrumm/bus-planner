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

    // Remove contradicting shift preferences (a shift can't be both preferred and avoided)
    this.preferredShifts = preferredShifts.filter(shift => !shiftsToAvoid.includes(shift));
    this.shiftsToAvoid = shiftsToAvoid;
    this.availableDays = availableDays;
  }

  public isAvailableOnDate(date: Date): boolean {
    // Ensure we're working with a proper Date object
    const checkDate = new Date(date);
    const dateString = checkDate.toISOString().split('T')[0];

    // Check if date is in unavailable dates
    if (
      this.unavailableDates.some(
        unavailableDate => {
          // Make sure we're comparing the date portions only
          const unavailableDateString = unavailableDate.toISOString().split('T')[0];
          return unavailableDateString === dateString;
        }
      )
    ) {
      return false;
    }

    // If availableDays is empty, driver is available on all days
    if (this.availableDays.length === 0) {
      return true;
    }

    // Check if day of week is in available days
    const dayOfWeek = checkDate
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
    // Create a clean date object with no time information
    const cleanDate = new Date(date.toISOString().split('T')[0]!);

    // Check if date is already marked as unavailable
    const dateString = cleanDate.toISOString().split('T')[0];
    const isAlreadyUnavailable = this.unavailableDates.some(
      unavailableDate => unavailableDate.toISOString().split('T')[0] === dateString
    );

    if (isAlreadyUnavailable) return;

    // Add the new unavailable date
    this.unavailableDates.push(cleanDate);
  }

  public markAvailable(date: Date): void {
    // Ensure we have a proper date object
    const cleanDate = new Date(date);
    const dateString = cleanDate.toISOString().split('T')[0];

    this.unavailableDates = this.unavailableDates.filter(
      unavailableDate =>
        unavailableDate.toISOString().split('T')[0] !== dateString
    );
  }

  /**
   * Checks if there are any contradictions in shift preferences
   * (shifts that appear in both preferred and avoid lists)
   */
  public hasContradictingPreferences(): boolean {
    return this.preferredShifts.some(shift => this.shiftsToAvoid.includes(shift));
  }

  /**
   * Resolves contradictions by removing conflicting shifts from preferredShifts
   * Returns the shifts that were removed
   */
  public resolveContradictions(): ShiftType[] {
    const contradictions = this.preferredShifts.filter(shift => 
      this.shiftsToAvoid.includes(shift));

    if (contradictions.length > 0) {
      this.preferredShifts = this.preferredShifts.filter(shift => 
        !this.shiftsToAvoid.includes(shift));
    }

    return contradictions;
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
    // Filter out any shifts that appear in both preferred and avoid lists before creating the driver
    const cleanPreferredShifts = (json.preferredShifts || []).filter(
      shift => !(json.shiftsToAvoid || []).includes(shift)
    );

    const driver = new Driver(
      json.fullName,
      json.weeklyHours,
      cleanPreferredShifts,
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
