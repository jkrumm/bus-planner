import * as React from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface DatePickerProps {
  dates: Date[];
  onDatesChange: (dates: Date[]) => void;
}

// Helper function to format date as YYYY-MM-DD string
function formatDateToString(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

// Helper function to safely convert any date-like input to a Date object
function safelyCreateDate(input: any): Date | null {
  if (!input) return null;

  try {
    const date = new Date(input);
    // Check if the date is valid
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (e) {
    console.error('Error creating date from input:', input, e);
    return null;
  }
}

export function DatePicker({ dates = [], onDatesChange }: DatePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // Clean up the dates array to ensure all entries are valid Date objects
  const validDates = React.useMemo(() => {
    return (dates || [])
      .map(date => safelyCreateDate(date))
      .filter(date => date !== null) as Date[];
  }, [dates]);

  // Process date selection from calendar
  const handleDateSelect = (selectedDates: Date[] | undefined) => {
    if (!selectedDates) return;

    // Convert all selected dates to proper Date objects
    const validSelectedDates = selectedDates
      .map(date => safelyCreateDate(date))
      .filter(date => date !== null) as Date[];

    onDatesChange(validSelectedDates);
  };

  // Remove a specific date
  const removeDate = (dateToRemove: Date) => {
    const dateString = formatDateToString(dateToRemove);
    const newDates = validDates.filter(
      date => formatDateToString(date) !== dateString
    );
    onDatesChange(newDates);
  };

  // Format a date for display
  const formatDateForDisplay = (date: Date): string => {
    try {
      return format(date, 'dd.MM.yyyy', { locale: de });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Ungültiges Datum';
    }
  };

  return (
    <div className="space-y-4">
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>Datum auswählen</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="multiple"
            selected={validDates}
            onSelect={handleDateSelect}
            initialFocus
            locale={de}
            weekStartsOn={1} // Monday as first day of week
          />
        </PopoverContent>
      </Popover>

      {validDates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {validDates
            .sort((a, b) => a.getTime() - b.getTime())
            .map((date, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {formatDateForDisplay(date)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => removeDate(date)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
