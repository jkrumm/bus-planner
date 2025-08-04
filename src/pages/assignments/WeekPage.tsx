import React from 'react';
import {
  useParams,
  useSearchParams,
  Link,
  useNavigate,
} from 'react-router-dom';
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
  addWeeks,
  subWeeks,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, X } from 'lucide-react';
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

// Function to get relative week label
function getRelativeWeekLabel(weekNum: number, currentWeekNum: number): string {
  const diff = weekNum - currentWeekNum;

  if (diff === 0) return 'Diese Woche';
  if (diff === 1) return 'Nächste Woche';
  if (diff === -1) return 'Letzte Woche';
  if (diff > 0) return `+${diff} Wochen`;
  return `${diff} Wochen`;
}

export function WeekPage() {
  const { week } = useParams<{ week: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get current date and week number
  const today = new Date();
  const currentWeekNumber = getISOWeek(today);
  const currentYear = getYear(today);

  // Use the week from URL or default to current week
  const weekNumber = week ? parseInt(week, 10) : currentWeekNumber;

  // Calculate the start date of the week (Monday)
  const weekStart = startOfISOWeek(
    setISOWeek(setYear(new Date(), currentYear), weekNumber)
  );

  // Generate array of dates for the week (Monday to Sunday)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Generate week tabs for Sprint Horizon (2 weeks before current week, current week, 5 weeks after)
  const generateWeekTabs = () => {
    const tabs = [];

    // Calculate the Sprint Horizon: 2 weeks before current week, current week, and 5 weeks after
    // Always show exactly 8 weeks total

    // Get 2 weeks before current week
    for (let i = 2; i >= 1; i--) {
      const weekNum = currentWeekNumber - i;
      // Skip negative week numbers
      if (weekNum <= 0) continue;

      const weekStartDate = startOfISOWeek(
        setISOWeek(setYear(new Date(), currentYear), weekNum)
      );

      tabs.push({
        weekNumber: weekNum,
        startDate: weekStartDate,
        displayDate: `KW ${weekNum}`,
        label: getRelativeWeekLabel(weekNum, currentWeekNumber),
        isActive: weekNum === weekNumber,
      });
    }

    // Current week
    tabs.push({
      weekNumber: currentWeekNumber,
      startDate: startOfISOWeek(today),
      displayDate: `KW ${currentWeekNumber}`,
      label: getRelativeWeekLabel(currentWeekNumber, currentWeekNumber),
      isActive: currentWeekNumber === weekNumber,
    });

    // 5 weeks after current week
    for (let i = 1; i <= 5; i++) {
      const weekNum = currentWeekNumber + i;
      // Skip weeks beyond 52/53
      if (weekNum > 53) continue;

      const weekStartDate = startOfISOWeek(
        setISOWeek(setYear(new Date(), currentYear), weekNum)
      );

      tabs.push({
        weekNumber: weekNum,
        startDate: weekStartDate,
        displayDate: `KW ${weekNum}`,
        label: getRelativeWeekLabel(weekNum, currentWeekNumber),
        isActive: weekNum === weekNumber,
      });
    }

    return tabs;
  };

  const weekTabs = generateWeekTabs();

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

  // Calculate progress for a week
  const getWeekProgress = (
    weekStartDate: Date
  ): { totalShifts: number; assignedShifts: number } | null => {
    // If no planning status data, return null
    if (!planningStatus || planningStatus.length === 0) return null;

    // Calculate the dates for the week (Monday to Sunday)
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStartDate, i);
      return format(date, 'yyyy-MM-dd');
    });

    // Get planning status for each day in the week
    const weekPlanningStatus = weekDates
      .map(dateString => planningByDate[dateString])
      .filter(Boolean);

    // If no planning status for any day in the week, return null
    if (weekPlanningStatus.length === 0) return null;

    // Calculate total shifts and assigned shifts for the week
    const totalShifts = weekPlanningStatus.reduce(
      (sum, day) => sum + day!.totalShifts,
      0
    );

    const assignedShifts = weekPlanningStatus.reduce(
      (sum, day) => sum + day!.assignedShifts,
      0
    );

    return { totalShifts, assignedShifts };
  };

  // Handle week selection
  const handleWeekSelect = (weekNum: number) => {
    navigate(`/assignments/week/${weekNum}`);
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 h-full max-h-[calc(100vh-64px)] overflow-auto">
      <div className="flex-shrink-0">
        <h1 className="text-xl mt-3 mb-4 md:text-2xl font-semibold">
          Wochenplanung - KW {week}
        </h1>
      </div>

      {/* Week selector */}
      <div className="flex-shrink-0">
        <ScrollArea className="w-full">
          <div className="flex gap-2 min-w-max">
            {weekTabs.map(tab => (
              <Card
                key={tab.weekNumber}
                className={cn(
                  'flex-1 cursor-pointer transition-colors hover:bg-muted/50',
                  tab.isActive
                    ? 'bg-muted shadow-sm'
                    : 'bg-background border-border hover:border-muted-foreground/30'
                )}
                onClick={() => handleWeekSelect(tab.weekNumber)}
              >
                <CardHeader className="p-2 pt-1 pb-0">
                  <CardTitle className="text-sm font-medium">
                    {tab.displayDate}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pb-1 pt-1">
                  <p className="text-xs text-muted-foreground">{tab.label}</p>
                  <p className="text-xs mt-1">
                    {format(tab.startDate, 'dd.MM.', { locale: de })} -{' '}
                    {format(addDays(tab.startDate, 6), 'dd.MM.', {
                      locale: de,
                    })}
                  </p>

                  {/* Week progress indicator */}
                  {getWeekProgress(tab.startDate) && (
                    <div className="mt-2 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground">
                          {getWeekProgress(tab.startDate)?.assignedShifts || 0}{' '}
                          von {getWeekProgress(tab.startDate)?.totalShifts || 0}
                        </span>
                        {getWeekProgress(tab.startDate)?.assignedShifts ===
                        getWeekProgress(tab.startDate)?.totalShifts ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <Progress
                        value={
                          getWeekProgress(tab.startDate)?.totalShifts || 0 > 0
                            ? (getWeekProgress(tab.startDate)?.assignedShifts ||
                                0 /
                                  (getWeekProgress(tab.startDate)
                                    ?.totalShifts || 1)) * 100
                            : 0
                        }
                        className="h-1"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 min-h-0 w-full">
        {/* Header row with column labels */}
        <div className="grid grid-cols-8 w-full mb-0">
          <div />
          {weekDates.map((date, index) => (
            <div key={index} className={cn('text-center p-2')}>
              <div className="text-sm pb-1 font-medium">{WEEKDAYS[index]}</div>
              <div className="text-xs text-muted-foreground">
                {getRelativeDayName(date)}
              </div>
              <div className="text-xs">
                {format(date, 'dd.MM.', { locale: de })}
              </div>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div className="mb-4">
          <div className="relative h-10">
            {/* Gesamt label */}
            <div className="grid grid-cols-8 w-full h-full">
              {/* Empty cells for spacing */}
              {Array(7)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="p-3"></div>
                ))}
            </div>

            {/* Summary bars with absolute positioning */}
            <div className="absolute top-0 left-0 w-full h-full grid grid-cols-8">
              {/* First column is for Gesamt label */}
              <div></div>

              {/* Bars for each day */}
              {weekDates.map((date, dayIndex) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const dayData = planningByDate[dateStr];
                const assignedShifts = dayData?.assignedShifts || 0;
                const totalShifts = dayData?.totalShifts || 0;
                const ratio =
                  totalShifts > 0 ? (assignedShifts / totalShifts) * 100 : 0;
                const isFullyAssigned = ratio === 100;
                const hasAssignments = ratio > 0;

                return (
                  <div
                    key={dayIndex}
                    className="flex items-center justify-center p-2"
                  >
                    <div className="flex flex-col items-center w-full">
                      <div className="text-sm font-medium mb-2 text-center">
                        {assignedShifts}/{totalShifts}
                      </div>
                      <Progress className="h-1" value={ratio} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* For each line, create a row with floating bars */}
        <div className="space-y-2">
          {allLines.map((line, lineIndex) => {
            // Find all days with shifts for this line
            const lineShifts = weekDates.map((date, dayIndex) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayData = planningByDate[dateStr];
              const lineData = dayData?.lines.find(l => l.id === line.id);

              return {
                date,
                dateStr,
                dayIndex,
                assignedShifts: lineData?.assignedShifts || 0,
                totalShifts: lineData?.totalShifts || 0,
                hasShifts: (lineData?.totalShifts || 0) > 0,
              };
            });

            return (
              <div key={line.id} className="relative h-14">
                {/* Line info */}
                <div className="grid grid-cols-8 w-full h-full">
                  <div className={cn('font-sm flex flex-col pt-2')}>
                    <span className="block text-sm font-medium">
                      {line.lineNumber}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {line.name}
                    </span>
                  </div>

                  {/* Empty cells for spacing */}
                  {Array(7)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="p-3"></div>
                    ))}
                </div>

                {/* Shift bars */}
                <div className="absolute top-0 left-0 w-full h-full grid grid-cols-8">
                  {/* First column is for line info */}
                  <div></div>

                  {/* Render individual bars for each day with shifts */}
                  {lineShifts.map((shift, dayIndex) => {
                    if (!shift.hasShifts) return null;

                    // Adjust column index to ensure Monday starts in the second column
                    const colIndex = dayIndex + 2; // +2 to skip the "Linien" column
                    const ratio =
                      shift.totalShifts > 0
                        ? (shift.assignedShifts / shift.totalShifts) * 100
                        : 0;

                    // Determine if this is the first or last day with shifts in a sequence
                    const prevDayHasShifts =
                      dayIndex > 0 && lineShifts[dayIndex - 1]!.hasShifts;
                    const nextDayHasShifts =
                      dayIndex < 6 && lineShifts[dayIndex + 1]!.hasShifts;

                    // Set rounded corners based on position in sequence
                    const roundedLeft = !prevDayHasShifts;
                    const roundedRight = !nextDayHasShifts;

                    return (
                      <div
                        key={dayIndex}
                        className="col-span-1 flex items-center justify-center h-full"
                        style={{
                          gridColumn: `${colIndex}`,
                        }}
                      >
                        <Link
                          to={`/assignments/day/${shift.dateStr}?lineId=${line.id}`}
                          className={cn(
                            'h-8 w-full mx-1 shadow-sm flex items-center justify-center transition-all my-auto',
                            roundedLeft && roundedRight
                              ? 'rounded-md'
                              : roundedLeft
                                ? 'rounded-l-md'
                                : roundedRight
                                  ? 'rounded-r-md'
                                  : '',
                            ratio === 100
                              ? 'bg-green-200/70 hover:bg-green-200/90 hover:shadow'
                              : ratio > 0
                                ? 'bg-amber-200/60 hover:bg-amber-200/80 hover:shadow'
                                : 'bg-gray-200/60 hover:bg-gray-200/80 hover:shadow'
                          )}
                        >
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-medium">
                              {shift.assignedShifts}/{shift.totalShifts}
                            </span>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
