import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Driver, ShiftType } from '@/models/entities/Driver';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, ColumnHeader } from '@/components/ui/data-table';
import type { ReactNode } from 'react';
import { useGetDrivers, useDeleteDriver } from '@/api/queries/drivers';

export function DriversPage() {
  const navigate = useNavigate();

  // Fetch drivers with centralized query hook
  const { data: drivers = [], isLoading, error } = useGetDrivers();

  // Define columns for the data table
  const columns: ColumnDef<Driver>[] = [
    {
      accessorKey: 'fullName',
      header: ({ column }) => <ColumnHeader column={column} title="Name" />,
      enableColumnFilter: true,
      enableGlobalFilter: true,
      enableSorting: true,
      filterFn: 'includesString',
      meta: { isSearchable: true },
      cell: ({ row }) => (
        <div className="px-4 py-2">{row.getValue('fullName')}</div>
      ),
    },
    {
      accessorKey: 'weeklyHours',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Wochenstunden" />
      ),
      enableGlobalFilter: true,
      cell: ({ row }) => {
        const hours = row.getValue('weeklyHours');
        return <div className="px-4 py-2">{hours as ReactNode}h</div>;
      },
    },
    {
      id: 'availableDays',
      accessorFn: row => {
        return row.availableDays || [];
      },
      header: ({ column }) => (
        <ColumnHeader column={column} title="Arbeitstage" />
      ),
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;

        const days = row.getValue(id) as string[];

        // Special case for "all-days" filter option
        if (filterValue.includes('all-days') && (!days || days.length === 0)) {
          return true;
        }

        // If driver is available on all days (empty array) and we're not
        // explicitly filtering for "all-days"
        if (!days || days.length === 0) {
          return false;
        }

        // Check if any of the filter values match any of the driver's days
        return filterValue.some((value: string) =>
          value === 'all-days' ? false : days.includes(value)
        );
      },
      cell: ({ row }) => {
        const days = row.original.availableDays as string[];
        if (days.length === 0)
          return <div className="px-4 py-2">Alle Tage</div>;

        const dayLabels: Record<string, string> = {
          monday: 'Montag',
          tuesday: 'Dienstag',
          wednesday: 'Mittwoch',
          thursday: 'Donnerstag',
          friday: 'Freitag',
          saturday: 'Samstag',
          sunday: 'Sonntag',
        };

        const displayText = days.map(day => dayLabels[day] || day).join(', ');
        return <div className="px-4 py-2">{displayText}</div>;
      },
    },
    {
      id: 'preferredShifts',
      accessorFn: row => {
        const shifts = row.preferredShifts as ShiftType[];
        if (shifts.length === 0) return 'none';
        return shifts;
      },
      header: ({ column }) => (
        <ColumnHeader column={column} title="Bevorzugte Schichten" />
      ),
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;

        const preferences = row.getValue(id);

        // Special case for "none" filter
        if (filterValue.includes('none') && preferences === 'none') return true;

        // Return true if any of the shift types match
        if (preferences === 'none') return false;

        return filterValue.some((value: string) =>
          (preferences as ShiftType[]).includes(value as ShiftType)
        );
      },
      cell: ({ row }) => {
        const shifts = row.original.preferredShifts as ShiftType[];
        if (shifts.length === 0)
          return <div className="px-4 py-2 text-gray-500">Keine Präferenz</div>;

        const shiftLabels = {
          [ShiftType.MORNING]: 'Früh',
          [ShiftType.AFTERNOON]: 'Spät',
          [ShiftType.NIGHT]: 'Nacht',
        };

        return (
          <div className="px-4 py-2">
            {shifts.map(shift => shiftLabels[shift]).join(', ')}
          </div>
        );
      },
    },
    {
      id: 'shiftsToAvoid',
      accessorFn: row => {
        const shifts = row.shiftsToAvoid as ShiftType[];
        if (shifts.length === 0) return 'none';
        return shifts;
      },
      header: ({ column }) => (
        <ColumnHeader column={column} title="Zu vermeiden" />
      ),
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;

        const avoids = row.getValue(id);

        // Special case for "none" filter
        if (filterValue.includes('none') && avoids === 'none') return true;

        // Return true if any of the shift types match
        if (avoids === 'none') return false;

        return filterValue.some((value: string) =>
          (avoids as ShiftType[]).includes(value as ShiftType)
        );
      },
      cell: ({ row }) => {
        const shifts = row.original.shiftsToAvoid as ShiftType[];
        if (shifts.length === 0)
          return <div className="px-4 py-2 text-gray-500">Keine</div>;

        const shiftLabels = {
          [ShiftType.MORNING]: 'Früh',
          [ShiftType.AFTERNOON]: 'Spät',
          [ShiftType.NIGHT]: 'Nacht',
        };

        return (
          <div className="px-4 py-2 text-orange-600">
            {shifts.map(shift => shiftLabels[shift]).join(', ')}
          </div>
        );
      },
    },
    {
      id: 'unavailableDates',
      accessorFn: row => {
        const dates = row.unavailableDates as Date[];
        return dates && dates.length > 0;
      },
      header: ({ column }) => (
        <ColumnHeader column={column} title="Verfügbarkeit" />
      ),
      enableColumnFilter: true,
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;

        const hasUnavailableDates = row.getValue(id);

        if (filterValue.includes('has-dates') && hasUnavailableDates)
          return true;
        if (filterValue.includes('no-dates') && !hasUnavailableDates)
          return true;

        return false;
      },
      cell: ({ row }) => {
        const dates = row.original.unavailableDates as Date[];
        if (!dates || !dates.length)
          return (
            <div className="px-4 py-2 flex items-center">
              <span className="mr-2 w-2 h-2 rounded-full bg-green-500"></span>
              Verfügbar
            </div>
          );

        return (
          <div className="px-4 py-2 flex items-center">
            <span className="mr-2 w-2 h-2 rounded-full bg-orange-500"></span>
            {dates.length} Datum{dates.length !== 1 ? 's' : ''}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: () => (
        <div className="px-4 py-2 font-medium text-right">Aktionen</div>
      ),
      cell: ({ row }) => {
        const driver = row.original;
        return (
          <div className="px-4 py-2 text-right flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="mr-2"
              onClick={() => handleEdit(driver)}
            >
              Bearbeiten
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(driver.id)}
            >
              Löschen
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  const filterableColumns = [
    {
      id: 'availableDays',
      title: 'Arbeitstage',
      options: [
        { value: 'all-days', label: 'Alle Tage' },
        { value: 'monday', label: 'Montag' },
        { value: 'tuesday', label: 'Dienstag' },
        { value: 'wednesday', label: 'Mittwoch' },
        { value: 'thursday', label: 'Donnerstag' },
        { value: 'friday', label: 'Freitag' },
        { value: 'saturday', label: 'Samstag' },
        { value: 'sunday', label: 'Sonntag' },
      ],
    },
    {
      id: 'preferredShifts',
      title: 'Bevorzugte Schichten',
      options: [
        { value: 'none', label: 'Keine Präferenz' },
        { value: ShiftType.MORNING, label: 'Frühschicht' },
        { value: ShiftType.AFTERNOON, label: 'Spätschicht' },
        { value: ShiftType.NIGHT, label: 'Nachtschicht' },
      ],
    },
    {
      id: 'shiftsToAvoid',
      title: 'Zu vermeiden',
      options: [
        { value: 'none', label: 'Keine' },
        { value: ShiftType.MORNING, label: 'Frühschicht' },
        { value: ShiftType.AFTERNOON, label: 'Spätschicht' },
        { value: ShiftType.NIGHT, label: 'Nachtschicht' },
      ],
    },
    {
      id: 'unavailableDates',
      title: 'Verfügbarkeit',
      options: [
        { value: 'has-dates', label: 'Eingeschränkt' },
        { value: 'no-dates', label: 'Immer verfügbar' },
      ],
    },
  ];

  // Delete driver mutation using centralized hook
  const deleteDriverMutation = useDeleteDriver();

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Fahrer löschen möchten?'))
      return;

    deleteDriverMutation.mutate(id);
  };

  const handleEdit = (driver: Driver) => {
    navigate(`/drivers/edit/${driver.id}`);
  };

  const handleAdd = () => {
    navigate('/drivers/new');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fahrer Stammdaten</h1>
        <Button onClick={handleAdd}>Neuer Fahrer</Button>
      </div>

      {/* Show React Query error */}
      {error instanceof Error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error.message}
        </div>
      )}

      {/* Show mutation error */}
      {deleteDriverMutation.error instanceof Error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {deleteDriverMutation.error.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">Fahrer werden geladen...</div>
      ) : drivers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10 text-muted-foreground">
              Keine Fahrer gefunden. Klicken Sie auf "Neuer Fahrer", um einen zu
              erstellen.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Fahrer</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={drivers}
              filterableColumns={filterableColumns}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
