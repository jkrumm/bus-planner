import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Line } from '@/models/entities/Line';
import { BusSize } from '@/models/entities/Bus';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface LineDetailCardProps {
  line: Line;
  date?: string;
}

// Map bus sizes to readable German names
const BUS_SIZE_NAMES = {
  [BusSize.SMALL]: 'Klein',
  [BusSize.MEDIUM]: 'Mittel',
  [BusSize.LARGE]: 'Groß',
  [BusSize.ARTICULATED]: 'Gelenkbus',
};

export function LineDetailCard({ line, date }: LineDetailCardProps) {
  return (
    <Card className="flex-shrink-0">
      <CardHeader className="p-3">
        <CardTitle className="text-sm">Liniendetails</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div>
            <h3 className="font-medium text-sm">Linie {line.lineNumber}</h3>
            <p className="text-xs text-muted-foreground">{line.routeName}</p>
          </div>
          <div className="flex gap-4 text-xs">
            <span>
              <span className="font-medium">Distanz:</span> {line.distanceKm} km
            </span>
            <span>
              <span className="font-medium">Dauer:</span> {line.durationMinutes}{' '}
              min
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium">Kompatible Busgrößen:</div>
            <div className="flex flex-wrap gap-1">
              {line.compatibleBusSizes.map(size => (
                <Badge key={size} variant="outline" className="text-xs">
                  {BUS_SIZE_NAMES[size] || size}
                </Badge>
              ))}
            </div>
          </div>

          {date && (
            <div className="text-xs">
              {(() => {
                const currentDate = new Date(date);
                const dayOfWeek = currentDate
                  .toLocaleDateString('en-US', { weekday: 'long' })
                  .toLowerCase() as keyof typeof line.weeklySchedule;
                const daySchedule = line.weeklySchedule[dayOfWeek];

                if (daySchedule) {
                  // Calculate accumulated distance for the day
                  const calculateAccumulatedDistance = () => {
                    // Convert time strings to minutes since midnight
                    const timeToMinutes = (time: string): number => {
                      const [hours, minutes] = time.split(':').map(Number);
                      if (hours === undefined || minutes === undefined)
                        throw new Error(
                          `Invalid time format: ${time}. Expected format is HH:MM.`
                        );
                      return hours * 60 + minutes;
                    };

                    // Calculate operating minutes for the day
                    const startMinutes = timeToMinutes(daySchedule.start);
                    const endMinutes = timeToMinutes(daySchedule.end);

                    // Handle cases where end time is on the next day
                    let operatingMinutes =
                      endMinutes > startMinutes
                        ? endMinutes - startMinutes
                        : 24 * 60 - startMinutes + endMinutes;

                    // Calculate number of full trips possible in the operating time
                    // We add a 10-minute buffer between trips for turnaround
                    const tripDuration = line.durationMinutes + 10; // minutes per trip plus buffer
                    const tripsCount = Math.floor(
                      operatingMinutes / tripDuration
                    );

                    // Calculate total distance for all trips
                    const totalDistance = tripsCount * line.distanceKm;

                    return totalDistance.toFixed(0);
                  };

                  const accumulatedDistance = calculateAccumulatedDistance();

                  return (
                    <div className="space-y-1">
                      <div className="text-xs">
                        <span className="font-medium">Betriebszeiten:</span>{' '}
                        {daySchedule.start} - {daySchedule.end}
                      </div>
                      <div className="text-xs">
                        <span className="font-medium">Tageskilometer:</span> ~
                        {accumulatedDistance} km
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-xs text-muted-foreground">
                      Kein Betrieb heute
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
