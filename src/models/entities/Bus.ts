import { v4 as uuidv4 } from 'uuid';

export enum BusSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  ARTICULATED = 'articulated',
}

export enum PropulsionType {
  DIESEL = 'diesel',
  ELECTRIC = 'electric',
}

export class Bus {
  public id: string;
  public licensePlate: string;
  public size: BusSize;
  public propulsionType: PropulsionType;
  public maxRangeKm?: number;
  public unavailableDates: Date[] = [];

  constructor(
    licensePlate: string,
    size: BusSize,
    propulsionType: PropulsionType,
    maxRangeKm?: number,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.licensePlate = licensePlate;
    this.size = size;
    this.propulsionType = propulsionType;
    this.maxRangeKm = maxRangeKm;
  }

  public isElectric(): boolean {
    return this.propulsionType === PropulsionType.ELECTRIC;
  }

  public canHandleDistance(distanceKm: number): boolean {
    if (!this.isElectric()) return true;
    return !!this.maxRangeKm && this.maxRangeKm >= distanceKm;
  }

  public isAvailableOnDate(date: Date): boolean {
    const dateString = date.toISOString().split('T')[0];
    return !this.unavailableDates.some(
      unavailableDate =>
        unavailableDate.toISOString().split('T')[0] === dateString
    );
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

  public toJSON(): any {
    return {
      id: this.id,
      licensePlate: this.licensePlate,
      size: this.size,
      propulsionType: this.propulsionType,
      maxRangeKm: this.maxRangeKm,
      unavailableDates: this.unavailableDates.map(date => date.toISOString()),
    };
  }

  public static fromJSON(json: any): Bus {
    const bus = new Bus(
      json.licensePlate,
      json.size as BusSize,
      json.propulsionType as PropulsionType,
      json.maxRangeKm,
      json.id
    );

    bus.unavailableDates = (json.unavailableDates || []).map(
      (dateStr: string) => new Date(dateStr)
    );

    return bus;
  }
}
