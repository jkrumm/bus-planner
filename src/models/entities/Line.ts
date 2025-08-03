import { v4 as uuidv4 } from 'uuid';
import { BusSize } from './Bus.js';

export interface LineJSON {
  id: string;
  lineNumber: string;
  routeName: string;
  distanceKm: number;
  durationMinutes: number;
  compatibleBusSizes: BusSize[];
  weeklySchedule: WeeklySchedule;
  isActive: boolean;
}

export interface TimeSchedule {
  start: string;
  end: string;
}

export interface WeeklySchedule {
  monday?: TimeSchedule;
  tuesday?: TimeSchedule;
  wednesday?: TimeSchedule;
  thursday?: TimeSchedule;
  friday?: TimeSchedule;
  saturday?: TimeSchedule;
  sunday?: TimeSchedule;
}

export class Line {
  public id: string;
  public lineNumber: string;
  public routeName: string;
  public distanceKm: number;
  public durationMinutes: number;
  public compatibleBusSizes: BusSize[];
  public weeklySchedule: WeeklySchedule;
  public isActive: boolean = true;

  constructor(
    lineNumber: string,
    routeName: string,
    distanceKm: number,
    durationMinutes: number,
    compatibleBusSizes: BusSize[],
    weeklySchedule: WeeklySchedule,
    isActive: boolean = true,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.lineNumber = lineNumber;
    this.routeName = routeName;
    this.distanceKm = distanceKm;
    this.durationMinutes = durationMinutes;
    this.compatibleBusSizes = compatibleBusSizes;
    this.weeklySchedule = weeklySchedule;
    this.isActive = isActive;
  }

  public isCompatibleWithBus(busSize: BusSize): boolean {
    return this.compatibleBusSizes.includes(busSize);
  }

  public operatesOnDate(date: Date): boolean {
    if (!this.isActive) return false;

    const dayOfWeek = date
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    return !!this.weeklySchedule[dayOfWeek as keyof WeeklySchedule];
  }

  public toJSON(): LineJSON {
    return {
      id: this.id,
      lineNumber: this.lineNumber,
      routeName: this.routeName,
      distanceKm: this.distanceKm,
      durationMinutes: this.durationMinutes,
      compatibleBusSizes: this.compatibleBusSizes,
      weeklySchedule: this.weeklySchedule,
      isActive: this.isActive,
    };
  }

  public static fromJSON(json: LineJSON): Line {
    return new Line(
      json.lineNumber,
      json.routeName,
      json.distanceKm,
      json.durationMinutes,
      json.compatibleBusSizes,
      json.weeklySchedule,
      json.isActive,
      json.id
    );
  }
}
