import { v4 as uuidv4 } from 'uuid';
import { ShiftType } from './Driver.js';

export interface AssignmentJSON {
  id: string;
  date: string;
  shift: ShiftType;
  lineId: string;
  busId: string;
  driverId: string;
  createdAt: string;
}

export class Assignment {
  public id: string;
  public date: Date;
  public shift: ShiftType;
  public lineId: string;
  public busId: string;
  public driverId: string;
  public createdAt: Date;

  constructor(
    date: Date,
    shift: ShiftType,
    lineId: string,
    busId: string,
    driverId: string,
    id?: string
  ) {
    this.id = id || uuidv4();
    this.date = new Date(date);
    this.shift = shift;
    this.lineId = lineId;
    this.busId = busId;
    this.driverId = driverId;
    this.createdAt = new Date();
  }

  public getDateKey(): string {
    return this.date.toISOString().split('T')[0]!;
  }

  public toJSON(): AssignmentJSON {
    return {
      id: this.id,
      date: this.date.toISOString(),
      shift: this.shift,
      lineId: this.lineId,
      busId: this.busId,
      driverId: this.driverId,
      createdAt: this.createdAt.toISOString(),
    };
  }

  public static fromJSON(json: AssignmentJSON): Assignment {
    const assignment = new Assignment(
      new Date(json.date),
      json.shift,
      json.lineId,
      json.busId,
      json.driverId,
      json.id
    );

    assignment.createdAt = new Date(json.createdAt);

    return assignment;
  }
}
