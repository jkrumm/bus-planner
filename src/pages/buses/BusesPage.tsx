import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, BusSize, PropulsionType } from '@/models/entities/Bus';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, ColumnHeader } from '@/components/ui/data-table';
import type { ReactNode } from 'react';
import { useGetBuses, useDeleteBus } from '@/api/queries/buses';

export function BusesPage() {
  const navigate = useNavigate();

  // Fetch buses with centralized query hook
  const { 
    data: buses = [], 
    isLoading, 
    error 
  } = useGetBuses();

  // Define columns for the data table
  const columns: ColumnDef<Bus>[] = [
    {
      accessorKey: 'licensePlate',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Kennzeichen" />
      ),
      enableColumnFilter: true,
      enableGlobalFilter: true,
      enableSorting: true,
      filterFn: 'includesString',
      meta: { isSearchable: true },
      enableColumnFilter: true,
      filterFn: 'includesString',
      cell: ({ row }) => (
        <div className="px-4 py-2">{row.getValue('licensePlate')}</div>
      ),
    },
    {
      accessorKey: 'size',
      header: ({ column }) => <ColumnHeader column={column} title="Größe" />,
      filterFn: 'orFilter', // Use the custom OR filter function
      cell: ({ row }) => {
        const size = row.getValue('size') as BusSize;
        const sizeLabels = {
          [BusSize.SMALL]: 'Klein',
          [BusSize.MEDIUM]: 'Mittel',
          [BusSize.LARGE]: 'Groß',
          [BusSize.ARTICULATED]: 'Gelenkbus',
        };
        return <div className="px-4 py-2">{sizeLabels[size] || size}</div>;
      },
    },
    {
      accessorKey: 'propulsionType',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Antriebsart" />
      ),
      filterFn: 'orFilter', // Use the custom OR filter function
      cell: ({ row }) => {
        const propType = row.getValue('propulsionType') as PropulsionType;
        const propLabels = {
          [PropulsionType.DIESEL]: 'Diesel',
          [PropulsionType.ELECTRIC]: 'Elektrisch',
        };
        return (
          <div className="px-4 py-2">{propLabels[propType] || propType}</div>
        );
      },
    },
    {
      accessorKey: 'maxRangeKm',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Max. Reichweite (km)" />
      ),
      cell: ({ row }) => {
        const value = row.getValue('maxRangeKm');
        return <div className="px-4 py-2">{value as ReactNode}</div>;
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
        const bus = row.original;
        return (
          <div className="px-4 py-2 text-right flex  justify-end">
            <Button
              variant="outline"
              size="sm"
              className="mr-2"
              onClick={() => handleEdit(bus)}
            >
              Bearbeiten
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(bus.id)}
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
      id: 'size',
      title: 'Größe',
      options: [
        { value: BusSize.SMALL, label: 'Klein' },
        { value: BusSize.MEDIUM, label: 'Mittel' },
        { value: BusSize.LARGE, label: 'Groß' },
        { value: BusSize.ARTICULATED, label: 'Gelenkbus' },
      ],
    },
    {
      id: 'propulsionType',
      title: 'Antriebsart',
      options: [
        { value: PropulsionType.DIESEL, label: 'Diesel' },
        { value: PropulsionType.ELECTRIC, label: 'Elektrisch' },
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

  // Delete bus mutation using centralized hook
  const deleteBusMutation = useDeleteBus();

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Bus löschen möchten?'))
      return;

    deleteBusMutation.mutate(id);
  };

  const handleEdit = (bus: Bus) => {
    navigate(`/busses/edit/${bus.id}`);
  };

  const handleAdd = () => {
    navigate('/busses/new');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Busse Stammdaten</h1>
        <Button onClick={handleAdd}>Neuer Bus</Button>
      </div>

      {/* Show React Query error */}
      {error instanceof Error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error.message}
        </div>
      )}

      {/* Show mutation error */}
      {deleteBusMutation.error instanceof Error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {deleteBusMutation.error.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">Busse werden geladen...</div>
      ) : buses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10 text-muted-foreground">
              Keine Busse gefunden. Klicken Sie auf "Neuer Bus", um einen zu
              erstellen.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Busse</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={buses}
              filterableColumns={filterableColumns}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
