import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from '@/models/entities/Line';
import { BusSize } from '@/models/entities/Bus';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, ColumnHeader } from '@/components/ui/data-table';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input.tsx';

export function LinesPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [filteredLines, setFilteredLines] = useState<Line[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Define columns for the data table
  const columns: ColumnDef<Line>[] = [
    {
      accessorKey: 'lineNumber',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Liniennummer" />
      ),
      enableColumnFilter: true,
      enableGlobalFilter: true,
      enableSorting: true,
      filterFn: (row, id, filterValue) => {
        const routeName = row.getValue(id) as string;
        return routeName
          .toLowerCase()
          .includes(String(filterValue).toLowerCase());
      },
      cell: ({ row }) => (
        <div className="px-4 py-2">{row.getValue('lineNumber')}</div>
      ),
    },
    {
      accessorKey: 'routeName',
      header: ({ column }) => <ColumnHeader column={column} title="Strecke" />,
      enableColumnFilter: true,
      enableGlobalFilter: true,
      enableSorting: true,
      filterFn: 'includesString',
      cell: ({ row }) => (
        <div className="px-4 py-2">{row.getValue('routeName')}</div>
      ),
    },
    {
      accessorKey: 'distanceKm',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Entfernung (km)" />
      ),
      cell: ({ row }) => {
        const value = row.getValue('distanceKm');
        return <div className="px-4 py-2">{value as ReactNode} km</div>;
      },
    },
    {
      accessorKey: 'durationMinutes',
      header: ({ column }) => (
        <ColumnHeader column={column} title="Dauer (min)" />
      ),
      cell: ({ row }) => {
        const value = row.getValue('durationMinutes');
        return <div className="px-4 py-2">{value as ReactNode} min</div>;
      },
    },
    {
      id: 'compatibleBusSizes',
      accessorFn: row => row.compatibleBusSizes,
      header: ({ column }) => (
        <ColumnHeader column={column} title="Kompatible Busse" />
      ),
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;

        const sizes = row.getValue(id) as BusSize[];
        return filterValue.some((value: string) =>
          sizes.includes(value as BusSize)
        );
      },
      cell: ({ row }) => {
        const sizes = row.original.compatibleBusSizes as BusSize[];
        const sizeLabels = {
          [BusSize.SMALL]: 'Klein',
          [BusSize.MEDIUM]: 'Mittel',
          [BusSize.LARGE]: 'Groß',
          [BusSize.ARTICULATED]: 'Gelenkbus',
        };

        return (
          <div className="px-4 py-2">
            {sizes.map(size => sizeLabels[size]).join(', ')}
          </div>
        );
      },
    },
    {
      id: 'weeklySchedule',
      accessorFn: row => {
        const schedule = row.weeklySchedule;
        return Object.keys(schedule).length > 0;
      },
      header: ({ column }) => <ColumnHeader column={column} title="Fahrplan" />,
      cell: ({ row }) => {
        const schedule = row.original.weeklySchedule;
        const dayCount = Object.keys(schedule).length;

        if (dayCount === 0) {
          return <div className="px-4 py-2 text-gray-500">Kein Fahrplan</div>;
        }

        return (
          <div className="px-4 py-2">
            {dayCount} Tag{dayCount !== 1 ? 'e' : ''}
          </div>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => <ColumnHeader column={column} title="Status" />,
      filterFn: (row, id, filterValue) => {
        if (!filterValue || filterValue.length === 0) return true;
        const isActive = row.getValue(id) as boolean;
        return filterValue.includes(isActive ? 'active' : 'inactive');
      },
      cell: ({ row }) => {
        const isActive = row.getValue('isActive') as boolean;
        return (
          <div className="px-4 py-2 flex items-center">
            <span
              className={`mr-2 w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}
            ></span>
            {isActive ? 'Aktiv' : 'Inaktiv'}
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
        const line = row.original;
        return (
          <div className="px-4 py-2 text-right flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="mr-2"
              onClick={() => handleEdit(line)}
            >
              Bearbeiten
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(line.id)}
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
      id: 'compatibleBusSizes',
      title: 'Kompatible Busse',
      options: [
        { value: BusSize.SMALL, label: 'Klein' },
        { value: BusSize.MEDIUM, label: 'Mittel' },
        { value: BusSize.LARGE, label: 'Groß' },
        { value: BusSize.ARTICULATED, label: 'Gelenkbus' },
      ],
    },
    {
      id: 'isActive',
      title: 'Status',
      options: [
        { value: 'active', label: 'Aktiv' },
        { value: 'inactive', label: 'Inaktiv' },
      ],
    },
  ];

  useEffect(() => {
    fetchLines();
  }, []);

  // Filtern der Linien basierend auf dem Suchbegriff
  useEffect(() => {
    if (lines.length > 0) {
      if (!searchQuery.trim()) {
        setFilteredLines(lines);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = lines.filter(
          line =>
            line.lineNumber.toLowerCase().includes(query) ||
            line.routeName.toLowerCase().includes(query)
        );
        setFilteredLines(filtered);
      }
    }
  }, [searchQuery, lines]);

  const fetchLines = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/lines');
      if (!response.ok) {
        throw new Error('Fehler beim Abrufen der Linien');
      }
      const data = await response.json();
      setLines(data);
      setFilteredLines(data);
      setError(null);
    } catch (err) {
      setError(
        'Fehler beim Abrufen der Linien: ' +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Linie löschen möchten?'))
      return;

    try {
      const response = await fetch(`/api/lines/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen der Linie');
      }

      // Refresh the lines list
      fetchLines();
    } catch (err) {
      setError(
        'Fehler beim Löschen der Linie: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  const handleEdit = (line: Line) => {
    navigate(`/lines/edit/${line.id}`);
  };

  const handleAdd = () => {
    navigate('/lines/new');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Linien Stammdaten</h1>
        <Button onClick={handleAdd}>Neue Linie</Button>
      </div>

      <div className="mb-4">
        <Input
          type="text"
          placeholder="Nach Liniennummer oder Strecke suchen..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">Linien werden geladen...</div>
      ) : filteredLines.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10 text-muted-foreground">
              {searchQuery
                ? `Keine Linien gefunden, die "${searchQuery}" enthalten.`
                : 'Keine Linien gefunden. Klicken Sie auf "Neue Linie", um eine zu erstellen.'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Linien</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredLines}
              filterableColumns={filterableColumns}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
