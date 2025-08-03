import type { FilterFn } from '@tanstack/react-table';

// OR filter - returns true if any value matches
export const orFilterFn: FilterFn<any> = (
  row,
  columnId,
  filterValues: string[]
) => {
  if (!filterValues || filterValues.length === 0) return true;
  const values = row.getValue(columnId);
  if (!Array.isArray(values)) return filterValues.includes(<string>values);
  return values.some(value => filterValues.includes(value));
};

// Global filter function for string-based search
export const globalFilterFn: FilterFn<any> = (row, columnId, value) => {
  const cellValue = row.getValue(columnId);

  // Handle different types of cell values
  if (typeof cellValue === 'string') {
    return cellValue.toLowerCase().includes(String(value).toLowerCase());
  }

  if (typeof cellValue === 'number') {
    return (
      cellValue === Number(value) || String(cellValue).includes(String(value))
    );
  }

  if (Array.isArray(cellValue)) {
    return cellValue.some(item =>
      String(item).toLowerCase().includes(String(value).toLowerCase())
    );
  }

  // Fall back to string comparison for other types
  if (cellValue) {
    return String(cellValue)
      .toLowerCase()
      .includes(String(value).toLowerCase());
  }

  return false;
};
