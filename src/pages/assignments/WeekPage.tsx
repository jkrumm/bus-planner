import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useGetPlanningStatus } from '@/api/queries/stats.ts';
import {
  format,
  addDays,
  parseISO,
  getISOWeek,
  getYear,
  setISOWeek,
  setYear,
  startOfISOWeek,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInCalendarDays,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  DailyPlanningStatus,
  LinePlanningStatus,
} from '@/state/AppState.ts';

// German day names
const WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

// Function to get relative day name
function getRelativeDayName(date: Date): string {
  if (isToday(date)) return 'Heute';
  if (isTomorrow(date)) return 'Morgen';
  if (isYesterday(date)) return 'Gestern';

  const diff = differenceInCalendarDays(date, new Date());
  if (diff === -2) return 'Vorgestern';
  if (diff === 2) return 'Übermorgen';
  if (diff < 0) return `${diff}`;
  if (diff > 0) return `+${diff}`;

  return '';
}

export function WeekPage() {
  const { week } = useParams<{ week: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekNumber = parseInt(week || '1', 10);

  // Get the current year
  const currentYear = getYear(new Date());

  // Calculate the start date of the week (Monday)
  const weekStart = startOfISOWeek(
    setISOWeek(setYear(new Date(), currentYear), weekNumber)
  );

  // Generate array of dates for the week (Monday to Sunday)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: planningStatus = [] } = useGetPlanningStatus();

  // Group planning status by date
  const planningByDate = planningStatus.reduce<
    Record<string, DailyPlanningStatus>
  >((acc, day) => {
    acc[day.date] = day;
    return acc;
  }, {});

  // Get all unique lines from planning status
  const allLines = Array.from(
    new Set(planningStatus.flatMap(day => day.lines.map(line => line.id)))
  ).map(lineId => {
    // Find first occurrence of this line to get its details
    const lineDetails = planningStatus
      .flatMap(day => day.lines)
      .find(line => line.id === lineId);

    return (
      lineDetails || {
        id: lineId,
        name: 'Unknown',
        lineNumber: 'Unknown',
        totalShifts: 0,
        assignedShifts: 0,
      }
    );
  });

  // Sort lines by line number
  allLines.sort((a, b) => a.lineNumber.localeCompare(b.lineNumber));

  return (
    <div className="w-full h-full p-0">
      <h1 className="text-xl m-4 md:text-2xl font-semibold my-7">
        Wochenplanung - KW {week}
      </h1>
      <div className="grid grid-cols-8 w-full h-[calc(100vh-155px)]">
        {/* Header row with column labels */}
        <div className="font-bold p-2 border-b border-r">Linien</div>
        {weekDates.map((date, index) => (
          <div key={index} className={cn('text-center p-2 border-b')}>
            <div className="text-xs text-muted-foreground">
              {getRelativeDayName(date)}
            </div>
            <div className="text-sm">
              {format(date, 'dd.MM.', { locale: de })}
            </div>
            <div className="font-bold pb-4">{WEEKDAYS[index]}</div>
          </div>
        ))}

        {/* For each line, create a row */}
        {allLines.map((line, lineIndex) => (
          <React.Fragment key={line.id}>
            <div
              className={cn(
                'font-medium flex flex-col p-2 border-r justify-center',
                lineIndex % 2 === 0 ? 'bg-gray-50' : ''
              )}
            >
              <span className="block">{line.lineNumber}</span>
              <span className="text-xs text-muted-foreground truncate">
                {line.name}
              </span>
            </div>

            {/* Create a cell for each day of the week */}
            {weekDates.map((date, dayIndex) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayData = planningByDate[dateStr];
              const lineData = dayData?.lines.find(l => l.id === line.id);

              const assignedShifts = lineData?.assignedShifts || 0;
              const totalShifts = lineData?.totalShifts || 0;
              const ratio =
                totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0;

              return (
                <Link
                  key={dayIndex}
                  to={`/assignments/day/${dateStr}?lineId=${line.id}`}
                  className={cn(
                    'block h-full border-l',
                    lineIndex % 2 === 0 ? 'bg-gray-50' : ''
                  )}
                >
                  <div className="h-full w-full flex items-center justify-center p-0">
                    {totalShifts > 0 ? (
                      <div
                        className={cn(
                          'text-xs text-center w-full h-full flex items-center justify-center py-2',
                          assignedShifts > 0
                            ? ratio === 100
                              ? 'bg-green-200/50'
                              : 'bg-amber-200/40'
                            : 'bg-gray-200/50 text-gray-500'
                        )}
                      >
                        {assignedShifts}/{totalShifts}
                      </div>
                    ) : (
                      <div className="text-xs text-center text-muted-foreground w-full h-full py-2"></div>
                    )}
                  </div>
                </Link>
              );
            })}
          </React.Fragment>
        ))}

        {/* Summary row */}
        <div className="font-bold p-2 border-t border-r bg-gray-100">
          Gesamt
        </div>
        {weekDates.map((date, dayIndex) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayData = planningByDate[dateStr];

          const assignedShifts = dayData?.assignedShifts || 0;
          const totalShifts = dayData?.totalShifts || 0;
          const ratio =
            totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0;

          return (
            <div key={dayIndex} className="p-2 border-t bg-gray-100">
              <div className="text-sm font-medium mb-1 text-center">
                {assignedShifts}/{totalShifts}
              </div>
              <Progress
                value={ratio}
                className={cn(
                  ratio === 100 ? 'bg-green-200' : 'bg-amber-200',
                  'h-3'
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
