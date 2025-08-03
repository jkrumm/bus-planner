import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import type { Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto h-9 lg:flex">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Spalten
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>Spalten anzeigen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            column =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map(column => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={value => column.toggleVisibility(!!value)}
              >
                {/* Bus columns */}
                {column.id === 'licensePlate' && 'Kennzeichen'}
                {column.id === 'size' && 'Größe'}
                {column.id === 'propulsionType' && 'Antriebsart'}
                {column.id === 'maxRangeKm' && 'Max. Reichweite (km)'}

                {/* Driver columns */}
                {column.id === 'fullName' && 'Name'}
                {column.id === 'weeklyHours' && 'Wochenstunden'}
                {column.id === 'availableDays' && 'Arbeitstage'}
                {column.id === 'preferredShifts' && 'Bevorzugte Schichten'}
                {column.id === 'shiftsToAvoid' && 'Zu vermeiden'}
                {column.id === 'unavailableDates' && 'Verfügbarkeit'}

                {/* Default fallback */}
                {/* Line columns */}
                {column.id === 'lineNumber' && 'Liniennummer'}
                {column.id === 'routeName' && 'Strecke'}
                {column.id === 'distanceKm' && 'Entfernung (km)'}
                {column.id === 'durationMinutes' && 'Dauer (min)'}
                {column.id === 'compatibleBusSizes' && 'Kompatible Busse'}
                {column.id === 'weeklySchedule' && 'Fahrplan'}
                {column.id === 'isActive' && 'Status'}

                {column.id !== 'licensePlate' &&
                  column.id !== 'size' &&
                  column.id !== 'propulsionType' &&
                  column.id !== 'maxRangeKm' &&
                  column.id !== 'fullName' &&
                  column.id !== 'weeklyHours' &&
                  column.id !== 'availableDays' &&
                  column.id !== 'preferredShifts' &&
                  column.id !== 'shiftsToAvoid' &&
                  column.id !== 'unavailableDates' &&
                  column.id !== 'lineNumber' &&
                  column.id !== 'routeName' &&
                  column.id !== 'distanceKm' &&
                  column.id !== 'durationMinutes' &&
                  column.id !== 'compatibleBusSizes' &&
                  column.id !== 'weeklySchedule' &&
                  column.id !== 'isActive' &&
                  column.id}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
