import { Cross2Icon } from '@radix-ui/react-icons';
import { Table } from '@tanstack/react-table';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from './data-table-view-options';
import { DataTableFacetedFilter } from './data-table-faceted-filter';

// Priority columns that are commonly used for searching
const SEARCH_PRIORITY_COLUMNS = [
  'fullName',
  'licensePlate',
  'lineNumber',
  'name',
  'id',
  'title',
  'email',
];

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterableColumns?: {
    id: string;
    title: string;
    options: {
      label: string;
      value: string;
      icon?: React.ComponentType<{ className?: string }>;
    }[];
  }[];
}

export function DataTableToolbar<TData>({
  table,
  filterableColumns = [],
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    !!table.getState().globalFilter;

  // Find a suitable searchable column
  const getSearchableColumn = () => {
    // Try priority columns first
    for (const colId of SEARCH_PRIORITY_COLUMNS) {
      const column = table.getColumn(colId);
      if (column && column.getCanFilter()) {
        return column;
      }
    }

    // Fall back to any filterable column
    const columns = table.getAllColumns();
    return columns.find(col => col.getCanFilter());
  };

  // Get the current search value
  const getSearchValue = () => {
    // Try global filter first
    if (table.getState().globalFilter) {
      return table.getState().globalFilter as string;
    }

    // Then check column filters on priority columns
    const filters = table.getState().columnFilters;
    for (const colId of SEARCH_PRIORITY_COLUMNS) {
      const filter = filters.find(f => f.id === colId);
      if (filter) return filter.value as string;
    }

    return '';
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    if (table.getGlobalFilteredRowModel) {
      // Use global filter if available
      table.setGlobalFilter(value);
    } else {
      // Otherwise find a suitable column to filter
      const column = getSearchableColumn();
      if (column) {
        if (!value) {
          // Clear all filters when search is empty
          table.resetColumnFilters();
        } else {
          column.setFilterValue(value);
        }
      }
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Suchen..."
          value={getSearchValue()}
          onChange={event => handleSearchChange(event.target.value)}
          className="h-9 w-[150px] lg:w-[250px]"
        />
        {filterableColumns.map(column =>
          table.getColumn(column.id) ? (
            <DataTableFacetedFilter
              key={column.id}
              column={table.getColumn(column.id)}
              title={column.title}
              options={column.options}
            />
          ) : null
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-9 px-2 lg:px-3"
          >
            Filter zurücksetzen
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
