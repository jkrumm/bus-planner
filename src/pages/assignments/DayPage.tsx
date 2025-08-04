import {
  useParams,
  useSearchParams,
  useNavigate,
  Link,
} from 'react-router-dom';

// German translations for shift types
const SHIFT_NAMES = {
  [ShiftType.MORNING]: 'Früh',
  [ShiftType.AFTERNOON]: 'Spät',
  [ShiftType.NIGHT]: 'Nacht',
};

// Short codes for shift types (for badges)
const SHIFT_CODES = {
  [ShiftType.MORNING]: 'F',
  [ShiftType.AFTERNOON]: 'S',
  [ShiftType.NIGHT]: 'N',
};
import { useState, useEffect } from 'react';
import {
  format,
  addDays,
  subDays,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInDays,
  differenceInCalendarDays,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useGetLines, useGetLine } from '@/api/queries/lines';
import { useGetBuses } from '@/api/queries/buses';
import { useGetDrivers } from '@/api/queries/drivers';
import {
  useCreateAssignment,
  useGetAssignmentsByDate,
  useDeleteAssignment,
} from '@/api/queries/assignments';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LineDetailCard } from '@/components/line-detail-card';
import { ShiftType } from '@/models/entities/Driver';
import { Bus, BusSize, PropulsionType } from '@/models/entities/Bus';
import { Driver } from '@/models/entities/Driver';
import {
  User,
  Bus as BusIcon,
  Info,
  Battery,
  Ruler,
  CheckCircle,
  X,
  Plus,
  Save,
  Trash,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function DayPage() {
  const { date } = useParams<{ date: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const lineId = searchParams.get('lineId');
  const shiftType = searchParams.get('shift') as ShiftType | null;
  // Removed separate selection mode for bus/driver - we now select both at once
  const navigate = useNavigate();

  // Track selected buses and drivers for each shift
  const [selectedBuses, setSelectedBuses] = useState<
    Record<ShiftType, string | null>
  >({
    [ShiftType.MORNING]: null,
    [ShiftType.AFTERNOON]: null,
    [ShiftType.NIGHT]: null,
  });

  const [selectedDrivers, setSelectedDrivers] = useState<
    Record<ShiftType, string | null>
  >({
    [ShiftType.MORNING]: null,
    [ShiftType.AFTERNOON]: null,
    [ShiftType.NIGHT]: null,
  });

  // For temp selections during selection mode
  const [tempSelectedBus, setTempSelectedBus] = useState<string | null>(null);
  const [tempSelectedDriver, setTempSelectedDriver] = useState<string | null>(
    null
  );

  // Format date for display
  const formattedDate = date
    ? format(new Date(date), 'dd.MM.yyyy', { locale: de })
    : '';

  // Helper function to check if shift times overlap with line operating hours
  const isShiftRequired = (shift: ShiftType): boolean => {
    if (!selectedLine || !date) return false;

    const currentDate = new Date(date);
    const dayOfWeek = currentDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase() as keyof typeof selectedLine.weeklySchedule;

    const daySchedule = selectedLine.weeklySchedule[dayOfWeek];
    if (!daySchedule) return false;

    // Define shift time ranges (24-hour format)
    const shiftRanges = {
      [ShiftType.MORNING]: { start: '05:00', end: '13:00' }, // Early shift: 5:00 - 13:00
      [ShiftType.AFTERNOON]: { start: '13:00', end: '21:00' }, // Late shift: 13:00 - 21:00
      [ShiftType.NIGHT]: { start: '21:00', end: '05:00' }, // Night shift: 21:00 - 05:00 (next day)
    };

    const shiftRange = shiftRanges[shift];
    const lineStart = daySchedule.start;
    const lineEnd = daySchedule.end;

    // Convert time strings to minutes since midnight for easier comparison
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      if (hours == undefined || minutes == undefined)
        throw new Error(
          `Invalid time format: ${time}. Expected format is HH:MM.`
        );
      return hours * 60 + minutes;
    };

    const shiftStartMinutes = timeToMinutes(shiftRange.start);
    let shiftEndMinutes = timeToMinutes(shiftRange.end);
    const lineStartMinutes = timeToMinutes(lineStart);
    const lineEndMinutes = timeToMinutes(lineEnd);

    // Handle night shift that crosses midnight
    if (shift === ShiftType.NIGHT) {
      shiftEndMinutes += 24 * 60; // Add 24 hours to represent next day
    }

    // Check for overlap
    if (shift === ShiftType.NIGHT) {
      // Night shift: check if line operates during 21:00-23:59 OR 00:00-05:00
      const nightStart = shiftStartMinutes; // 21:00
      const nightEnd = 24 * 60; // 23:59
      const earlyMorningStart = 0; // 00:00
      const earlyMorningEnd = timeToMinutes('05:00'); // 05:00

      // Check overlap with evening hours (21:00-23:59)
      const eveningOverlap =
        lineStartMinutes < nightEnd && lineEndMinutes > nightStart;

      // Check overlap with early morning hours (00:00-05:00)
      const morningOverlap =
        lineStartMinutes < earlyMorningEnd &&
        lineEndMinutes > earlyMorningStart;

      return eveningOverlap || morningOverlap;
    } else {
      // Regular shifts: check for time range overlap
      return (
        lineStartMinutes < shiftEndMinutes && lineEndMinutes > shiftStartMinutes
      );
    }
  };

  // Generate date navigation tabs (5 days before, current day, 5 days after)
  const generateDateTabs = () => {
    if (!date) return [];

    const currentDate = new Date(date);
    const tabs = [];

    // Generate 5 days before current date
    for (let i = 5; i >= 1; i--) {
      const tabDate = subDays(currentDate, i);
      tabs.push({
        date: tabDate,
        dateString: format(tabDate, 'yyyy-MM-dd'),
        displayDate: format(tabDate, 'dd.MM.yyyy'),
        displayDay: format(tabDate, 'EEEE', { locale: de }),
        label: getDateLabel(tabDate),
        isActive: false,
      });
    }

    // Add current date
    tabs.push({
      date: currentDate,
      dateString: format(currentDate, 'yyyy-MM-dd'),
      displayDate: format(currentDate, 'dd.MM.yyyy'),
      displayDay: format(currentDate, 'EEEE', { locale: de }),
      label: getDateLabel(currentDate),
      isActive: true,
    });

    // Generate 5 days after current date
    for (let i = 1; i <= 5; i++) {
      const tabDate = addDays(currentDate, i);
      tabs.push({
        date: tabDate,
        dateString: format(tabDate, 'yyyy-MM-dd'),
        displayDate: format(tabDate, 'dd.MM.yyyy'),
        displayDay: format(tabDate, 'EEEE', { locale: de }),
        label: getDateLabel(tabDate),
        isActive: false,
      });
    }

    return tabs;
  };

  // Get appropriate label for date (Heute, Gestern, Morgen, etc.)
  const getDateLabel = (date: Date) => {
    const diff = differenceInCalendarDays(date, new Date());
    if (diff === 0) return 'Heute';
    if (diff === +1) return 'Morgen';
    if (diff === +2) return 'Übermorgen';
    if (diff === -1) return 'Gestern';
    if (diff === -2) return 'Vorgestern';
    return `${diff > 0 ? '+' : ''}${diff} Tage`;
  };

  const dateTabs = generateDateTabs();

  // Fetch all data
  const { data: lines, isLoading: isLoadingLines } = useGetLines();
  const { data: buses, isLoading: isLoadingBuses } = useGetBuses();
  const { data: drivers, isLoading: isLoadingDrivers } = useGetDrivers();

  // Fetch the selected line details if lineId is present
  const { data: selectedLine } = useGetLine(lineId || undefined);

  // Get the readable line name for display
  const selectedLineName = selectedLine
    ? `${selectedLine.lineNumber} - ${selectedLine.routeName}`
    : '';

  // Helper to get bus and driver names
  const getBusName = (busId: string) => {
    const bus = buses?.find(b => b.id === busId);
    return bus ? bus.licensePlate : 'Unknown Bus';
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers?.find(d => d.id === driverId);
    return driver ? driver.fullName : 'Unknown Driver';
  };

  // Handle line selection
  const handleLineSelect = (selectedLineId: string) => {
    // Reset all selections when changing lines
    setSelectedBuses({
      [ShiftType.MORNING]: null,
      [ShiftType.AFTERNOON]: null,
      [ShiftType.NIGHT]: null,
    });
    setSelectedDrivers({
      [ShiftType.MORNING]: null,
      [ShiftType.AFTERNOON]: null,
      [ShiftType.NIGHT]: null,
    });

    // Set the search parameters to the new line ID
    setSearchParams({ lineId: selectedLineId });
  };

  // Handle shift selection (combined bus and driver selection)
  const handleShiftSelect = (shift: ShiftType) => {
    // Don't allow selection if shift is not required
    if (!isShiftRequired(shift)) return;

    // Reset temporary selections when entering a new shift selection
    if (shiftType !== shift) {
      setTempSelectedBus(null);
      setTempSelectedDriver(null);
    }

    // If we're already in this shift, exit selection mode
    if (shiftType === shift) {
      setSearchParams({ lineId: lineId || '' });
      return;
    }

    // Otherwise, set the shift for selection
    setSearchParams({
      lineId: lineId || '',
      shift: shift,
    });
  };

  // Determine if we're in selection mode
  const isSelectionMode = !!shiftType;

  // Function to check if we have both a bus and driver assigned for a shift
  const isShiftComplete = (shift: ShiftType) => {
    return selectedBuses[shift] !== null && selectedDrivers[shift] !== null;
  };

  // Function to check if all assignments for active shift are ready to save
  const canSaveAssignment = () => {
    if (!lineId || !shiftType) return false;

    // Need both a bus and a driver to save an assignment
    // Either from temporary selections or permanent ones
    const hasBus =
      tempSelectedBus !== null || selectedBuses[shiftType] !== null;
    const hasDriver =
      tempSelectedDriver !== null || selectedDrivers[shiftType] !== null;

    return hasBus && hasDriver;
  };

  // Function to check if an assignment can be deleted
  const canDeleteAssignment = () => {
    if (!lineId || !shiftType || !date) return false;

    // Check if there's an existing assignment for this line, shift, and date
    const currentDateString = new Date(date).toISOString().split('T')[0];
    const existingAssignment = existingAssignments?.find(
      assignment =>
        assignment.lineId === lineId &&
        assignment.shift === shiftType &&
        new Date(assignment.date).toISOString().split('T')[0] ===
          currentDateString
    );

    return !!existingAssignment;
  };

  // Function to check if a line has all required shifts assigned
  const isLineFullyAssigned = (lineId: string): boolean => {
    if (!date) return false;

    // Get the line data
    const line = lines?.find(l => l.id === lineId);
    if (!line) return false;

    // Check each shift type
    const morningRequired = isShiftRequiredForLine(ShiftType.MORNING, line);
    const afternoonRequired = isShiftRequiredForLine(ShiftType.AFTERNOON, line);
    const nightRequired = isShiftRequiredForLine(ShiftType.NIGHT, line);

    // Get assignments for this line
    const lineAssignments =
      existingAssignments?.filter(a => a.lineId === lineId) || [];

    // Check if all required shifts have both bus and driver assigned
    if (morningRequired) {
      const morningAssignment = lineAssignments.find(
        a => a.shift === ShiftType.MORNING
      );
      if (
        !morningAssignment ||
        !morningAssignment.busId ||
        !morningAssignment.driverId
      )
        return false;
    }

    if (afternoonRequired) {
      const afternoonAssignment = lineAssignments.find(
        a => a.shift === ShiftType.AFTERNOON
      );
      if (
        !afternoonAssignment ||
        !afternoonAssignment.busId ||
        !afternoonAssignment.driverId
      )
        return false;
    }

    if (nightRequired) {
      const nightAssignment = lineAssignments.find(
        a => a.shift === ShiftType.NIGHT
      );
      if (
        !nightAssignment ||
        !nightAssignment.busId ||
        !nightAssignment.driverId
      )
        return false;
    }

    // If we've made it here, all required shifts are assigned
    return morningRequired || afternoonRequired || nightRequired;
  };

  // Function to check if any shifts are required for a line
  const hasRequiredShifts = (lineId: string): boolean => {
    if (!date) return false;

    // Get the line data
    const line = lines?.find(l => l.id === lineId);
    if (!line) return false;

    // Check if any shift is required
    return (
      isShiftRequiredForLine(ShiftType.MORNING, line) ||
      isShiftRequiredForLine(ShiftType.AFTERNOON, line) ||
      isShiftRequiredForLine(ShiftType.NIGHT, line)
    );
  };

  // Helper to check if a shift is required for a specific line
  const isShiftRequiredForLine = (shift: ShiftType, line: any): boolean => {
    if (!date) return false;

    const currentDate = new Date(date);
    const dayOfWeek = currentDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase() as keyof typeof line.weeklySchedule;

    const daySchedule = line.weeklySchedule[dayOfWeek];
    if (!daySchedule) return false;

    // Define shift time ranges (24-hour format)
    const shiftRanges = {
      [ShiftType.MORNING]: { start: '05:00', end: '13:00' },
      [ShiftType.AFTERNOON]: { start: '13:00', end: '21:00' },
      [ShiftType.NIGHT]: { start: '21:00', end: '05:00' },
    };

    const shiftRange = shiftRanges[shift];
    const lineStart = daySchedule.start;
    const lineEnd = daySchedule.end;

    // Convert time strings to minutes since midnight for easier comparison
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      if (hours == undefined || minutes == undefined)
        throw new Error(`Invalid time format: ${time}`);
      return hours * 60 + minutes;
    };

    const shiftStartMinutes = timeToMinutes(shiftRange.start);
    let shiftEndMinutes = timeToMinutes(shiftRange.end);
    const lineStartMinutes = timeToMinutes(lineStart);
    const lineEndMinutes = timeToMinutes(lineEnd);

    // Handle night shift that crosses midnight
    if (shift === ShiftType.NIGHT) {
      shiftEndMinutes += 24 * 60; // Add 24 hours to represent next day
    }

    // Check for overlap
    if (shift === ShiftType.NIGHT) {
      // Night shift: check if line operates during 21:00-23:59 OR 00:00-05:00
      const nightStart = shiftStartMinutes; // 21:00
      const nightEnd = 24 * 60; // 23:59
      const earlyMorningStart = 0; // 00:00
      const earlyMorningEnd = timeToMinutes('05:00'); // 05:00

      // Check overlap with evening hours (21:00-23:59)
      const eveningOverlap =
        lineStartMinutes < nightEnd && lineEndMinutes > nightStart;

      // Check overlap with early morning hours (00:00-05:00)
      const morningOverlap =
        lineStartMinutes < earlyMorningEnd &&
        lineEndMinutes > earlyMorningStart;

      return eveningOverlap || morningOverlap;
    } else {
      // Regular shifts: check for time range overlap
      return (
        lineStartMinutes < shiftEndMinutes && lineEndMinutes > shiftStartMinutes
      );
    }
  };

  // Use the create and delete assignment mutations
  const createAssignmentMutation = useCreateAssignment();
  const deleteAssignmentMutation = useDeleteAssignment();

  // Get existing assignments for the selected date
  const { data: existingAssignments, isLoading: isLoadingAssignments } =
    useGetAssignmentsByDate(date);

  // Update selected buses and drivers when existing assignments are loaded
  useEffect(() => {
    if (
      existingAssignments &&
      existingAssignments.length > 0 &&
      lineId &&
      date
    ) {
      // Get current date string for comparison
      const currentDateString = new Date(date).toISOString().split('T')[0];

      // Filter assignments for the current line and date
      const lineAssignments = existingAssignments.filter(
        assignment =>
          assignment.lineId === lineId &&
          new Date(assignment.date).toISOString().split('T')[0] ===
            currentDateString
      );

      // Create new state objects
      const newSelectedBuses = { ...selectedBuses };
      const newSelectedDrivers = { ...selectedDrivers };

      // Update state based on existing assignments
      lineAssignments.forEach(assignment => {
        newSelectedBuses[assignment.shift] = assignment.busId;
        newSelectedDrivers[assignment.shift] = assignment.driverId;
      });

      // Update state
      setSelectedBuses(newSelectedBuses);
      setSelectedDrivers(newSelectedDrivers);
    }
  }, [existingAssignments, lineId, date]);

  // Score drivers for the current shift and date
  const scoreDriver = (driver: Driver, shift: ShiftType): number => {
    if (!date) return 0;

    let score = 0; // Start from 0 instead of 50
    // Ensure we work with a proper Date object for comparison
    const currentDate = new Date(date);
    const weekday = currentDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();

    // Perfect match criteria counter
    let perfectMatchCriteria = 0;
    let totalCriteria = 0;

    // 1. Check for unavailable dates first (highest priority) - 25 points
    totalCriteria++;
    if (driver.unavailableDates && driver.unavailableDates.length > 0) {
      // Check if this date is in the driver's unavailable dates list
      const isAvailable = driver.isAvailableOnDate(currentDate);
      if (isAvailable) {
        perfectMatchCriteria++;
        score += 25; // Available on this date
      }
      // If unavailable, score remains 0 for this criteria (no penalty needed)
    } else {
      // No unavailable dates set - perfect
      perfectMatchCriteria++;
      score += 25;
    }

    // 2. Check for weekly availability - 25 points
    totalCriteria++;
    if (driver.availableDays && driver.availableDays.length > 0) {
      if (driver.availableDays.includes(weekday)) {
        perfectMatchCriteria++;
        score += 25; // Available on this weekday
      }
      // If not available on this weekday, score remains 0 for this criteria
    } else {
      // Driver is available all days - perfect
      perfectMatchCriteria++;
      score += 25;
    }

    // 3. Check shift preference - 25 points
    totalCriteria++;
    if (driver.hasShiftPreference && driver.hasShiftPreference(shift)) {
      // Driver explicitly prefers this shift - PERFECT
      perfectMatchCriteria++;
      score += 25;
    } else if (driver.avoidsShift && driver.avoidsShift(shift)) {
      // Driver explicitly avoids this shift - BAD
      score += 0; // No points for avoiding the shift
    } else {
      // Driver is neutral about this shift - GOOD but not perfect
      score += 15; // Good but less than preference
      // Don't count as perfect match criteria since it's not a preference
    }
    // If driver avoids this shift, score remains 0 for this criteria

    // 4. Check for existing assignments on same day (different shift) - 25 points
    totalCriteria++;
    const hasOtherShiftToday =
      existingAssignments?.some(
        a =>
          a.driverId === driver.id &&
          new Date(a.date).toDateString() === currentDate.toDateString() &&
          a.shift !== shift
      ) || false;

    if (!hasOtherShiftToday) {
      // Driver is free for the whole day - perfect
      // This could be good or bad depending on context
      // Here we treat it as positive for continuity
      perfectMatchCriteria++;
      score += 25;
    } else {
      // Driver has another shift - could be continuity, give partial credit
      score += 15; // Partial credit for continuity
      // Don't count as perfect match criteria
    }

    // Bonus for perfect matches: if all criteria are perfectly met, ensure 100%
    if (perfectMatchCriteria === totalCriteria) {
      score = 100; // Guarantee perfect score
    }

    // For near-perfect matches (missing only one criteria), give a high score
    // Add a small random factor to differentiate otherwise equal scores (0-2 points)
    else if (perfectMatchCriteria === totalCriteria - 1) {
      score = Math.max(score, 95); // At least 95% for near-perfect
    }

    // Severe penalties for critical issues that should prevent assignment
    if (driver.unavailableDates && driver.unavailableDates.length > 0) {
      const isAvailable = driver.isAvailableOnDate(currentDate);
      if (!isAvailable) {
        score = Math.min(score, 10); // Cap at 10% for unavailable drivers
      }
    }

    if (
      driver.availableDays &&
      driver.availableDays.length > 0 &&
      !driver.availableDays.includes(weekday)
    ) {
      score = Math.min(score, 15); // Cap at 15% for drivers not working this day
    }

    if (driver.avoidsShift && driver.avoidsShift(shift)) {
      score = Math.min(score, 20); // Cap at 20% for drivers avoiding this shift
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  // Score buses for the current line, shift and date
  const scoreBus = (bus: Bus, shift: ShiftType): number => {
    if (!date || !selectedLine) return 0;

    let score = 50; // Base score
    const currentDate = new Date(date);

    // Perfect match criteria counter
    let perfectMatchCriteria = 0;
    let totalCriteria = 0;

    // 1. Check for unavailable dates first (highest priority)
    totalCriteria++;
    if (bus.unavailableDates && bus.unavailableDates.length > 0) {
      const isAvailable = bus.isAvailableOnDate(currentDate);
      if (!isAvailable) {
        // Bus is explicitly unavailable on this date (maintenance, etc.)
        score -= 90; // Severe penalty
      } else {
        perfectMatchCriteria++;
      }
    } else {
      perfectMatchCriteria++;
    }

    // 2. Check if bus is already assigned to another shift on the same day
    totalCriteria++;
    const hasOtherShiftToday =
      existingAssignments?.some(
        a =>
          a.busId === bus.id &&
          new Date(a.date).toDateString() === currentDate.toDateString() &&
          a.shift !== shift
      ) || false;

    if (hasOtherShiftToday) {
      // It's usually not ideal to have a bus doing multiple shifts
      // but it's not a critical issue
      score -= 30;
    } else {
      perfectMatchCriteria++;
      score += 10;
    }

    // 3. Check if bus size is compatible with the line
    totalCriteria++;
    if (selectedLine.compatibleBusSizes.includes(bus.size)) {
      perfectMatchCriteria++;
      // More compatible bus sizes means more flexibility in the fleet
      // Give higher scores to buses with a size that's less common in compatible sizes
      const compatibleSizesCount = selectedLine.compatibleBusSizes.length;
      const sizePriorityBonus =
        compatibleSizesCount > 1 ? 5 / compatibleSizesCount : 0;
      score += 20 + Math.round(sizePriorityBonus);
    } else {
      score -= 50; // Major penalty for size incompatibility
    }

    // 4. For electric buses, check range capacity against the line's accumulated distance
    if (bus.isElectric()) {
      totalCriteria++;

      // Calculate accumulated distance for the line on this day
      const accumulatedDistance = calculateLineAccumulatedDistance();

      if (accumulatedDistance > 0) {
        // Check if bus has sufficient range with different buffer levels
        const rangeSafety = bus.checkRangeSafety(accumulatedDistance, 20); // 20% buffer

        if (rangeSafety.isSafe) {
          perfectMatchCriteria++;
          // Bonus based on actual buffer percentage (max +25 points)
          score += Math.min(25, rangeSafety.actualBufferPercent / 4);
        } else {
          // Penalty depends on how close the bus is to having sufficient range
          // If buffer is nearly enough (>10%), smaller penalty
          if (rangeSafety.actualBufferPercent > 10) {
            score -= 20;
          }
          // If buffer is very small (>0% but <10%), larger penalty
          else if (rangeSafety.actualBufferPercent > 0) {
            score -= 40;
          }
          // If range isn't even sufficient without buffer, severe penalty
          else {
            score -= 70;
          }
        }
      } else {
        // If we can't calculate accumulated distance, we assume it's fine
        perfectMatchCriteria++;
      }
    }

    // Perfect match bonus - if all criteria are met, ensure score can reach 100
    if (perfectMatchCriteria === totalCriteria) {
      score += 100 - score; // Boost to 100% for perfect matches
    }

    // Add a small random factor to differentiate otherwise equal scores (0-2 points)
    if (perfectMatchCriteria !== totalCriteria) {
      // Don't add randomness to perfect scores
      score += Math.floor(Math.random() * 3);
    }

    return Math.max(0, Math.min(100, Math.round(score))); // Round and clamp between 0-100
  };

  // Function to calculate accumulated distance for the selected line on the current date
  const calculateLineAccumulatedDistance = (): number => {
    if (!selectedLine || !date) return 0;

    const currentDate = new Date(date);
    const dayOfWeek = currentDate
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase() as keyof typeof selectedLine.weeklySchedule;

    const daySchedule = selectedLine.weeklySchedule[dayOfWeek];
    if (!daySchedule) return 0;

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
    const tripDuration = selectedLine.durationMinutes + 10; // minutes per trip plus buffer
    const tripsCount = Math.floor(operatingMinutes / tripDuration);

    // Calculate total distance for all trips
    return tripsCount * selectedLine.distanceKm;
  };

  // Sort drivers based on their score for the current shift
  // When scores are equal, sort by weekly working hours and then by name
  const getSortedDrivers = (): Driver[] => {
    if (!drivers || !shiftType) return drivers || [];

    return [...drivers].sort((a, b) => {
      const scoreA = scoreDriver(a, shiftType);
      const scoreB = scoreDriver(b, shiftType);

      // First sort by score (descending order - highest first)
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // If scores are equal, sort by weekly hours (descending)
      if (a.weeklyHours !== b.weeklyHours) {
        return b.weeklyHours - a.weeklyHours;
      }

      // If hours are also equal, sort alphabetically by name
      return a.fullName.localeCompare(b.fullName);
    });
  };

  // Sort buses based on their score for the current shift and line
  const getSortedBuses = (): Bus[] => {
    if (!buses || !shiftType || !selectedLine) return buses || [];

    return [...buses].sort((a, b) => {
      const scoreA = scoreBus(a, shiftType);
      const scoreB = scoreBus(b, shiftType);

      // First sort by score (descending order - highest first)
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // If scores are equal, prioritize diesel buses for routes with long distances
      if (a.propulsionType !== b.propulsionType) {
        const accumulatedDistance = calculateLineAccumulatedDistance();
        if (accumulatedDistance > 200) {
          // For long routes, diesel might be preferred
          return a.propulsionType === PropulsionType.DIESEL ? -1 : 1;
        } else {
          // For shorter routes, electric might be preferred
          return a.propulsionType === PropulsionType.ELECTRIC ? -1 : 1;
        }
      }

      // If still equal, sort by license plate
      return a.licensePlate.localeCompare(b.licensePlate);
    });
  };

  // Get opacity level based on driver score
  const getDriverOpacity = (driver: Driver): string => {
    if (!shiftType) return '';

    const score = scoreDriver(driver, shiftType);
    if (score >= 70) return ''; // Full opacity for good matches
    if (score >= 40) return 'opacity-70';
    if (score >= 20) return 'opacity-50';
    return 'opacity-30'; // Very poor matches
  };

  // Get opacity level based on bus score
  const getBusOpacity = (bus: Bus): string => {
    if (!shiftType || !selectedLine) return '';

    const score = scoreBus(bus, shiftType);
    if (score >= 70) return ''; // Full opacity for good matches
    if (score >= 40) return 'opacity-70';
    if (score >= 20) return 'opacity-50';
    return 'opacity-30'; // Very poor matches
  };

  // Function to delete the current assignment
  const handleDeleteAssignment = () => {
    if (!lineId || !shiftType || !date) return;

    // Find the existing assignment
    const existingAssignment = existingAssignments?.find(
      assignment =>
        assignment.lineId === lineId &&
        assignment.shift === shiftType &&
        new Date(assignment.date).toISOString().split('T')[0] === date
    );

    if (existingAssignment) {
      deleteAssignmentMutation.mutate(existingAssignment.id, {
        onSuccess: () => {
          // Clear selections after successful deletion
          setSelectedBuses(prev => ({
            ...prev,
            [shiftType]: null,
          }));
          setSelectedDrivers(prev => ({
            ...prev,
            [shiftType]: null,
          }));
          setTempSelectedBus(null);
          setTempSelectedDriver(null);
        },
      });
    }
  };

  // Function to save the current assignment
  const saveAssignment = () => {
    if (!lineId || !shiftType || !date) return;

    let busId: string | null = null;
    let driverId: string | null = null;

    // Get the bus and driver IDs from both permanent and temporary selections
    busId = tempSelectedBus || selectedBuses[shiftType];
    driverId = tempSelectedDriver || selectedDrivers[shiftType];

    if (!busId || !driverId) return;

    // Update the selected buses and drivers
    setSelectedBuses(prev => ({
      ...prev,
      [shiftType]: busId,
    }));

    setSelectedDrivers(prev => ({
      ...prev,
      [shiftType]: driverId,
    }));

    // Create and save the assignment using the mutation
    createAssignmentMutation.mutate(
      {
        date: date,
        shift: shiftType,
        lineId: lineId,
        busId: busId,
        driverId: driverId,
      },
      {
        onSuccess: result => {
          console.log('Assignment saved successfully:', result);
          // Exit selection mode
          setSearchParams({ lineId: lineId || '' });

          // Reset temporary selections
          setTempSelectedBus(null);
          setTempSelectedDriver(null);
        },
        onError: error => {
          console.error('Error saving assignment:', error);
          // You could display an error message to the user here
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 h-full max-h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">
            Zuweisung für den {formattedDate}
            {lineId && selectedLineName ? ` (${selectedLineName})` : ''}
          </h1>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs font-medium">
              {`Bus ${tempSelectedBus ? '✓' : ''} und Fahrer ${tempSelectedDriver ? '✓' : ''} auswählen`}
            </div>
            <div className="flex gap-2">
              <Button
                disabled={
                  !canSaveAssignment() || createAssignmentMutation.isPending
                }
                className="flex gap-2 items-center"
                onClick={saveAssignment}
                variant={canSaveAssignment() ? 'default' : 'outline'}
              >
                <Save className="h-4 w-4" />
                {createAssignmentMutation.isPending
                  ? 'Speichere...'
                  : 'Speichern'}
              </Button>
              <Button
                onClick={handleDeleteAssignment}
                disabled={
                  !canDeleteAssignment() || deleteAssignmentMutation.isPending
                }
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash className="h-4 w-4" />
                {deleteAssignmentMutation.isPending ? 'Lösche...' : 'Löschen'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Date Navigation Tabs */}
      <div className="flex-shrink-0">
        <ScrollArea className="w-full">
          <div className="flex gap-2 min-w-max">
            {dateTabs.map(tab => (
              <Link
                key={tab.dateString}
                to={`/assignments/day/${tab.dateString}${lineId ? `?lineId=${lineId}` : ''}`}
                className="flex-1"
              >
                <div
                  className={cn(
                    'p-3 rounded-lg border text-center transition-all hover:bg-muted/50',
                    tab.isActive
                      ? 'bg-muted shadow-sm'
                      : 'bg-background border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div className="text-sm font-medium">{tab.label}</div>
                  <div className="text-xs">{tab.displayDate}</div>
                  <div className="text-xs capitalize">{tab.displayDay}</div>
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main content grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[200px_280px_1fr] gap-4">
        {/* Column 1: Lines Navigation */}
        <div className="lg:col-span-1">
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-2">
              {isLoadingLines ? (
                <p className="text-center text-muted-foreground py-8">
                  Wird geladen...
                </p>
              ) : (
                lines?.map((line, index) => {
                  // Check if line is inactive or has no shifts needed today
                  const isInactiveOrNoShifts =
                    !line.isActive ||
                    !line.operatesOnDate(date ? new Date(date) : new Date());
                  const isFullyAssigned = isLineFullyAssigned(line.id);
                  const hasShifts = hasRequiredShifts(line.id);

                  return (
                    <div key={line.id} className="w-full">
                      <button
                        onClick={() => handleLineSelect(line.id)}
                        className={cn(
                          'w-full p-3 text-center rounded-lg border text-sm transition-all',
                          lineId === line.id
                            ? 'bg-muted shadow-sm'
                            : 'bg-background border-border hover:border-muted-foreground/30',
                          isInactiveOrNoShifts
                            ? 'opacity-40 hover:opacity-60'
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className={cn(
                              'font-medium',
                              isInactiveOrNoShifts && 'text-muted-foreground'
                            )}
                          >
                            {line.lineNumber}
                          </div>
                          {!isInactiveOrNoShifts &&
                            hasShifts &&
                            (isFullyAssigned ? (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <X className="h-3 w-3 text-red-500" />
                            ))}
                        </div>
                        <div className="text-xs text-muted-foreground break-words">
                          {line.routeName}
                        </div>
                      </button>
                    </div>
                  );
                })
              )}

              {!isLoadingLines && (!lines || lines.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  Keine Linien vorhanden
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 2: Middle column with line details and shifts */}
        <div className="lg:col-span-1">
          <div className="flex flex-col gap-3 h-full">
            {/* Line Details - Fixed height */}
            {lineId && selectedLine ? (
              <LineDetailCard line={selectedLine} date={date} />
            ) : (
              <Card className="flex-shrink-0">
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <p className="text-center text-muted-foreground py-4 text-xs">
                    Wählen Sie eine Linie aus
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Shifts - Compact layout */}
            <div className="flex flex-col gap-3">
              {/* Morning Shift */}
              <Card
                className={cn(
                  'flex-shrink-0 h-auto',
                  shiftType === ShiftType.MORNING && 'border-blue-500 border-2',
                  lineId &&
                    isShiftRequired(ShiftType.MORNING) &&
                    'cursor-pointer hover:bg-muted/50 transition-colors',
                  lineId && !isShiftRequired(ShiftType.MORNING) && 'opacity-40'
                )}
                onClick={() => {
                  if (lineId && isShiftRequired(ShiftType.MORNING)) {
                    handleShiftSelect(ShiftType.MORNING);
                  }
                }}
              >
                <CardHeader className="flex-shrink-0 p-3">
                  <CardTitle
                    className={cn(
                      'text-sm flex items-center justify-between',
                      lineId &&
                        !isShiftRequired(ShiftType.MORNING) &&
                        'text-muted-foreground'
                    )}
                  >
                    <span>{SHIFT_NAMES[ShiftType.MORNING]} (05:00-13:00)</span>
                    {lineId &&
                      isShiftRequired(ShiftType.MORNING) &&
                      (isShiftComplete(ShiftType.MORNING) ? (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 ml-2" />
                      ))}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-3">
                  {lineId && selectedLine ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Bus:</span>
                        <span
                          className={
                            selectedBuses[ShiftType.MORNING]
                              ? ''
                              : 'text-muted-foreground'
                          }
                        >
                          {selectedBuses[ShiftType.MORNING]
                            ? getBusName(selectedBuses[ShiftType.MORNING])
                            : 'Nicht zugewiesen'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Fahrer:</span>
                        <span
                          className={
                            selectedDrivers[ShiftType.MORNING]
                              ? ''
                              : 'text-muted-foreground'
                          }
                        >
                          {selectedDrivers[ShiftType.MORNING]
                            ? getDriverName(selectedDrivers[ShiftType.MORNING])
                            : 'Nicht zugewiesen'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-xs">
                      Wählen Sie eine Linie aus
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Afternoon Shift */}
              <Card
                className={cn(
                  'flex-shrink-0 h-auto',
                  shiftType === ShiftType.AFTERNOON &&
                    'border-blue-500 border-2',
                  lineId &&
                    isShiftRequired(ShiftType.AFTERNOON) &&
                    'cursor-pointer hover:bg-muted/50 transition-colors',
                  lineId &&
                    !isShiftRequired(ShiftType.AFTERNOON) &&
                    'opacity-40'
                )}
                onClick={() => {
                  if (lineId && isShiftRequired(ShiftType.AFTERNOON)) {
                    handleShiftSelect(ShiftType.AFTERNOON);
                  }
                }}
              >
                <CardHeader className="flex-shrink-0 p-3">
                  <CardTitle
                    className={cn(
                      'text-sm flex items-center justify-between',
                      lineId &&
                        !isShiftRequired(ShiftType.AFTERNOON) &&
                        'text-muted-foreground'
                    )}
                  >
                    <span>
                      {SHIFT_NAMES[ShiftType.AFTERNOON]} (13:00-21:00)
                    </span>
                    {lineId &&
                      isShiftRequired(ShiftType.AFTERNOON) &&
                      (isShiftComplete(ShiftType.AFTERNOON) ? (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 ml-2" />
                      ))}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-3">
                  {lineId && selectedLine ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Bus:</span>
                        <span
                          className={
                            selectedBuses[ShiftType.AFTERNOON]
                              ? ''
                              : 'text-muted-foreground'
                          }
                        >
                          {selectedBuses[ShiftType.AFTERNOON]
                            ? getBusName(selectedBuses[ShiftType.AFTERNOON])
                            : 'Nicht zugewiesen'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Fahrer:</span>
                        <span
                          className={
                            selectedDrivers[ShiftType.AFTERNOON]
                              ? ''
                              : 'text-muted-foreground'
                          }
                        >
                          {selectedDrivers[ShiftType.AFTERNOON]
                            ? getDriverName(
                                selectedDrivers[ShiftType.AFTERNOON]
                              )
                            : 'Nicht zugewiesen'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-xs">
                      Wählen Sie eine Linie aus
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Night Shift */}
              <Card
                className={cn(
                  'flex-shrink-0 h-auto',
                  shiftType === ShiftType.NIGHT && 'border-blue-500 border-2',
                  lineId &&
                    isShiftRequired(ShiftType.NIGHT) &&
                    'cursor-pointer hover:bg-muted/50 transition-colors',
                  lineId && !isShiftRequired(ShiftType.NIGHT) && 'opacity-40'
                )}
                onClick={() => {
                  if (lineId && isShiftRequired(ShiftType.NIGHT)) {
                    handleShiftSelect(ShiftType.NIGHT);
                  }
                }}
              >
                <CardHeader className="flex-shrink-0 p-3">
                  <CardTitle
                    className={cn(
                      'text-sm flex items-center justify-between',
                      lineId &&
                        !isShiftRequired(ShiftType.NIGHT) &&
                        'text-muted-foreground'
                    )}
                  >
                    <span>{SHIFT_NAMES[ShiftType.NIGHT]} (21:00-05:00)</span>
                    {lineId &&
                      isShiftRequired(ShiftType.NIGHT) &&
                      (isShiftComplete(ShiftType.NIGHT) ? (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 ml-2" />
                      ))}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-3">
                  {lineId && selectedLine ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Bus:</span>
                        <span
                          className={
                            selectedBuses[ShiftType.NIGHT]
                              ? ''
                              : 'text-muted-foreground'
                          }
                        >
                          {selectedBuses[ShiftType.NIGHT]
                            ? getBusName(selectedBuses[ShiftType.NIGHT])
                            : 'Nicht zugewiesen'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Fahrer:</span>
                        <span
                          className={
                            selectedDrivers[ShiftType.NIGHT]
                              ? ''
                              : 'text-muted-foreground'
                          }
                        >
                          {selectedDrivers[ShiftType.NIGHT]
                            ? getDriverName(selectedDrivers[ShiftType.NIGHT])
                            : 'Nicht zugewiesen'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-xs">
                      Wählen Sie eine Linie aus
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Column 3: Buses and Drivers */}
        <div className="lg:col-span-1">
          <div className="flex flex-col gap-4 h-full">
            {/* Buses Section - Fixed height */}
            <Card className="h-[37vh] flex flex-col">
              <CardHeader className="flex-shrink-0 p-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center">
                    <BusIcon className="h-4 w-4 mr-1" />
                    <span>Busse</span>
                  </div>
                  {isSelectionMode && (
                    <span className="text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                      Auswahl aktiv
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-2">
                <ScrollArea className="h-full">
                  {isLoadingBuses ? (
                    <p className="text-center text-muted-foreground py-8">
                      Wird geladen...
                    </p>
                  ) : !isSelectionMode ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-center text-muted-foreground mb-2 text-xs">
                        Wählen Sie eine Schicht aus
                      </p>
                      <div className="flex gap-2">
                        {lineId && isShiftRequired(ShiftType.MORNING) && (
                          <Badge
                            className="cursor-pointer"
                            onClick={() => handleShiftSelect(ShiftType.MORNING)}
                          >
                            {SHIFT_NAMES[ShiftType.MORNING]}
                          </Badge>
                        )}
                        {lineId && isShiftRequired(ShiftType.AFTERNOON) && (
                          <Badge
                            className="cursor-pointer"
                            onClick={() =>
                              handleShiftSelect(ShiftType.AFTERNOON)
                            }
                          >
                            {SHIFT_NAMES[ShiftType.AFTERNOON]}
                          </Badge>
                        )}
                        {lineId && isShiftRequired(ShiftType.NIGHT) && (
                          <Badge
                            className="cursor-pointer"
                            onClick={() => handleShiftSelect(ShiftType.NIGHT)}
                          >
                            {SHIFT_NAMES[ShiftType.NIGHT]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <TooltipProvider>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                        {getSortedBuses().map((bus: Bus) => {
                          // Calculate bus score for the tooltip and styling
                          const busScore = shiftType
                            ? scoreBus(bus, shiftType)
                            : 0;
                          const accumulatedDistance =
                            calculateLineAccumulatedDistance();
                          const rangeSafety =
                            bus.isElectric() && accumulatedDistance > 0
                              ? bus.checkRangeSafety(accumulatedDistance, 20)
                              : { isSafe: true, actualBufferPercent: 100 };

                          // Check if bus is already assigned to another shift today
                          const alreadyAssignedToday =
                            date &&
                            existingAssignments?.some(
                              a =>
                                a.busId === bus.id &&
                                new Date(a.date).toDateString() ===
                                  new Date(date).toDateString() &&
                                (!shiftType || a.shift !== shiftType)
                            );

                          return (
                            <Tooltip key={bus.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'p-2 border rounded-md hover:bg-muted/50 flex flex-col h-20 transition-all',
                                    isSelectionMode && shiftType
                                      ? 'cursor-pointer'
                                      : '',
                                    tempSelectedBus === bus.id &&
                                      'border-blue-500 border-2 bg-blue-50/50',
                                    shiftType &&
                                      selectedBuses[shiftType] === bus.id &&
                                      'border-green-500 border-2 bg-green-50/50',
                                    date &&
                                      !bus.isAvailableOnDate(new Date(date)) &&
                                      'opacity-40 border-red-200',
                                    getBusOpacity(bus)
                                  )}
                                  onClick={() => {
                                    if (isSelectionMode && shiftType) {
                                      if (tempSelectedBus === bus.id) {
                                        setTempSelectedBus(null);
                                      } else {
                                        setTempSelectedBus(bus.id);
                                      }
                                    }
                                  }}
                                >
                                  <div className="flex justify-between items-center">
                                    <p className="font-medium text-sm truncate">
                                      {bus.licensePlate}
                                    </p>
                                    <div className="flex gap-1 items-center">
                                      {shiftType && (
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            'h-3 text-[9px] px-1',
                                            busScore === 100
                                              ? 'text-blue-600 border-blue-200 bg-blue-50'
                                              : busScore >= 70
                                                ? 'text-green-600 border-green-200 bg-green-50'
                                                : busScore >= 40
                                                  ? 'text-amber-600 border-amber-200 bg-amber-50'
                                                  : 'text-red-600 border-red-200 bg-red-50'
                                          )}
                                        >
                                          {busScore}%
                                        </Badge>
                                      )}
                                      <Badge
                                        variant={
                                          bus.propulsionType ===
                                          PropulsionType.ELECTRIC
                                            ? 'default'
                                            : 'secondary'
                                        }
                                        className="text-xs h-4"
                                      >
                                        {bus.propulsionType ===
                                        PropulsionType.ELECTRIC
                                          ? 'Elektro'
                                          : 'Diesel'}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>
                                          {bus.size === BusSize.SMALL
                                            ? 'Klein'
                                            : bus.size === BusSize.MEDIUM
                                              ? 'Mittel'
                                              : bus.size === BusSize.LARGE
                                                ? 'Groß'
                                                : bus.size ===
                                                    BusSize.ARTICULATED
                                                  ? 'Gelenkbus'
                                                  : bus.size}
                                        </span>
                                        {bus.propulsionType ===
                                          PropulsionType.ELECTRIC && (
                                          <span
                                            className={cn(
                                              bus.isElectric() &&
                                                !rangeSafety.isSafe &&
                                                'text-amber-600 font-medium'
                                            )}
                                          >
                                            {bus.maxRangeKm || '--'} km
                                          </span>
                                        )}

                                        {date &&
                                          !bus.isAvailableOnDate(
                                            new Date(date)
                                          ) && (
                                            <Badge
                                              variant="destructive"
                                              className="text-[9px] h-3 px-1"
                                            >
                                              Nicht verfügbar
                                            </Badge>
                                          )}
                                      </div>

                                      <div className="flex items-center gap-1">
                                        {alreadyAssignedToday && (
                                          <Badge className="text-[9px] h-3 px-1 bg-blue-500">
                                            Bereits eingeplant
                                          </Badge>
                                        )}

                                        {(tempSelectedBus === bus.id ||
                                          (shiftType &&
                                            selectedBuses[shiftType] ===
                                              bus.id)) && (
                                          <CheckCircle
                                            className={cn(
                                              'h-4 w-4',
                                              tempSelectedBus === bus.id
                                                ? 'text-blue-500'
                                                : 'text-green-500'
                                            )}
                                          />
                                        )}
                                      </div>
                                    </div>

                                    {bus.isElectric() && selectedLine && (
                                      <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground">
                                          Reichweite:
                                          <span
                                            className={cn(
                                              !rangeSafety.isSafe &&
                                                'text-amber-600 font-medium'
                                            )}
                                          >
                                            {rangeSafety.actualBufferPercent}%
                                            Puffer
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="p-3 w-[250px]">
                                <div className="space-y-2">
                                  <div className="font-medium">
                                    {bus.licensePlate}
                                  </div>
                                  {shiftType && (
                                    <div className="text-xs">
                                      <span className="font-medium">
                                        Übereinstimmung:
                                      </span>{' '}
                                      <span
                                        className={cn(
                                          busScore === 100
                                            ? 'text-blue-600 font-bold'
                                            : busScore >= 70
                                              ? 'text-green-600'
                                              : busScore >= 40
                                                ? 'text-amber-600'
                                                : 'text-red-600'
                                        )}
                                      >
                                        {busScore}%
                                      </span>
                                    </div>
                                  )}

                                  <div className="text-xs space-y-1">
                                    <div>
                                      <span className="font-medium">Typ:</span>{' '}
                                      {bus.size === BusSize.SMALL
                                        ? 'Klein'
                                        : bus.size === BusSize.MEDIUM
                                          ? 'Mittel'
                                          : bus.size === BusSize.LARGE
                                            ? 'Groß'
                                            : bus.size === BusSize.ARTICULATED
                                              ? 'Gelenkbus'
                                              : bus.size}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Antrieb:
                                      </span>{' '}
                                      {bus.propulsionType ===
                                      PropulsionType.ELECTRIC
                                        ? 'Elektrisch'
                                        : 'Diesel'}
                                    </div>
                                    {bus.propulsionType ===
                                      PropulsionType.ELECTRIC && (
                                      <div>
                                        <span className="font-medium">
                                          Maximale Reichweite:
                                        </span>{' '}
                                        {bus.maxRangeKm || '--'} km
                                      </div>
                                    )}

                                    {date && (
                                      <div className="mt-2">
                                        <span className="font-medium text-xs">
                                          Verfügbarkeit am{' '}
                                          {format(
                                            new Date(date),
                                            'dd.MM.yyyy',
                                            { locale: de }
                                          )}
                                          :
                                        </span>{' '}
                                        <span
                                          className={cn(
                                            'text-xs',
                                            bus.isAvailableOnDate(
                                              new Date(date)
                                            )
                                              ? 'text-green-600'
                                              : 'text-red-600 font-medium'
                                          )}
                                        >
                                          {bus.isAvailableOnDate(new Date(date))
                                            ? 'Verfügbar'
                                            : 'Nicht verfügbar'}
                                        </span>
                                      </div>
                                    )}

                                    {alreadyAssignedToday && (
                                      <div className="mt-1">
                                        <span className="font-medium text-xs text-blue-600">
                                          Bereits heute für andere Schicht
                                          eingeplant
                                        </span>
                                      </div>
                                    )}

                                    {bus.isElectric() &&
                                      selectedLine &&
                                      accumulatedDistance > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <div>
                                            <span className="font-medium">
                                              Tagesfahrstrecke:
                                            </span>{' '}
                                            {accumulatedDistance} km
                                          </div>
                                          <div>
                                            <span className="font-medium">
                                              Benötigte Reichweite (20% Puffer):
                                            </span>{' '}
                                            {Math.round(
                                              accumulatedDistance * 1.2
                                            )}{' '}
                                            km
                                          </div>
                                          <div>
                                            <span className="font-medium">
                                              Reichweitenstatus:
                                            </span>{' '}
                                            <span
                                              className={cn(
                                                rangeSafety.isSafe
                                                  ? 'text-green-600'
                                                  : 'text-amber-600 font-medium'
                                              )}
                                            >
                                              {rangeSafety.isSafe
                                                ? `Ausreichend (${rangeSafety.actualBufferPercent}% Puffer)`
                                                : `Knapp (nur ${rangeSafety.actualBufferPercent}% Puffer)`}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Drivers Section - Fixed height */}
            <Card className="h-[37vh] flex flex-col">
              <CardHeader className="flex-shrink-0 p-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    <span>Fahrer</span>
                  </div>
                  {isSelectionMode && (
                    <span className="text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                      Auswahl aktiv
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-2">
                <ScrollArea className="h-full">
                  {isLoadingDrivers ? (
                    <p className="text-center text-muted-foreground py-8">
                      Wird geladen...
                    </p>
                  ) : !isSelectionMode ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-center text-muted-foreground mb-2 text-xs">
                        Wählen Sie eine Schicht aus
                      </p>
                      <div className="flex gap-2">
                        {lineId && isShiftRequired(ShiftType.MORNING) && (
                          <Badge
                            className="cursor-pointer"
                            onClick={() => handleShiftSelect(ShiftType.MORNING)}
                          >
                            {SHIFT_NAMES[ShiftType.MORNING]}
                          </Badge>
                        )}
                        {lineId && isShiftRequired(ShiftType.AFTERNOON) && (
                          <Badge
                            className="cursor-pointer"
                            onClick={() =>
                              handleShiftSelect(ShiftType.AFTERNOON)
                            }
                          >
                            {SHIFT_NAMES[ShiftType.AFTERNOON]}
                          </Badge>
                        )}
                        {lineId && isShiftRequired(ShiftType.NIGHT) && (
                          <Badge
                            className="cursor-pointer"
                            onClick={() => handleShiftSelect(ShiftType.NIGHT)}
                          >
                            {SHIFT_NAMES[ShiftType.NIGHT]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <TooltipProvider>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                        {getSortedDrivers().map((driver: Driver) => (
                          <Tooltip key={driver.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'p-2 border rounded-md hover:bg-muted/50 flex flex-col h-20 transition-all',
                                  isSelectionMode && shiftType
                                    ? 'cursor-pointer'
                                    : '',
                                  tempSelectedDriver === driver.id &&
                                    'border-blue-500 border-2 bg-blue-50/50',
                                  shiftType &&
                                    selectedDrivers[shiftType] === driver.id &&
                                    'border-green-500 border-2 bg-green-50/50',
                                  date &&
                                    !driver.isAvailableOnDate(new Date(date)) &&
                                    'opacity-40 border-red-200',
                                  getDriverOpacity(driver)
                                )}
                                onClick={() => {
                                  if (isSelectionMode && shiftType) {
                                    if (tempSelectedDriver === driver.id) {
                                      setTempSelectedDriver(null);
                                    } else {
                                      setTempSelectedDriver(driver.id);
                                    }
                                  }
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <p className="font-medium text-sm truncate">
                                    {driver.fullName}
                                  </p>
                                  <div className="flex gap-1 items-center">
                                    {shiftType && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'h-3 text-[9px] px-1',
                                          scoreDriver(driver, shiftType) === 100
                                            ? 'text-blue-600 border-blue-200 bg-blue-50'
                                            : scoreDriver(driver, shiftType) >=
                                                70
                                              ? 'text-green-600 border-green-200 bg-green-50'
                                              : scoreDriver(
                                                    driver,
                                                    shiftType
                                                  ) >= 40
                                                ? 'text-amber-600 border-amber-200 bg-amber-50'
                                                : 'text-red-600 border-red-200 bg-red-50'
                                        )}
                                      >
                                        {scoreDriver(driver, shiftType)}%
                                      </Badge>
                                    )}
                                    {shiftType &&
                                      driver.hasShiftPreference &&
                                      driver.hasShiftPreference(shiftType) && (
                                        <Badge
                                          variant="outline"
                                          className="h-3 text-[9px] px-1 text-green-600 border-green-200 bg-green-50"
                                        >
                                          Bevorzugt
                                        </Badge>
                                      )}
                                    {shiftType &&
                                      driver.avoidsShift &&
                                      driver.avoidsShift(shiftType) && (
                                        <Badge
                                          variant="outline"
                                          className="h-3 text-[9px] px-1 text-red-600 border-red-200 bg-red-50"
                                        >
                                          Vermeidet
                                        </Badge>
                                      )}
                                    {(tempSelectedDriver === driver.id ||
                                      (shiftType &&
                                        selectedDrivers[shiftType] ===
                                          driver.id)) && (
                                      <CheckCircle
                                        className={cn(
                                          'h-4 w-4',
                                          tempSelectedDriver === driver.id
                                            ? 'text-blue-500'
                                            : 'text-green-500'
                                        )}
                                      />
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1 mt-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground">
                                        {driver.weeklyHours} Std/Woche
                                      </span>
                                      {date &&
                                        driver.isAvailableOnDate &&
                                        !driver.isAvailableOnDate(
                                          new Date(date)
                                        ) && (
                                          <Badge
                                            variant="destructive"
                                            className="text-[9px] h-3 px-1"
                                          >
                                            Nicht verfügbar
                                          </Badge>
                                        )}
                                    </div>

                                    <div className="flex gap-1">
                                      {/* Always show all three shift types */}
                                      {Object.values(ShiftType).map(shift => {
                                        const isPreferred =
                                          driver.hasShiftPreference(shift);
                                        const isAvoided =
                                          driver.avoidsShift(shift);

                                        // Get the badge label from the constant
                                        const label = SHIFT_CODES[shift];

                                        // Check if driver is unavailable on this day for this shift
                                        const isUnavailable =
                                          date &&
                                          !driver.isAvailableOnDate(
                                            new Date(date)
                                          );

                                        return (
                                          <Badge
                                            key={`${driver.id}-shift-${shift}`}
                                            variant="outline"
                                            className={cn(
                                              'text-[10px] h-3 px-1',
                                              isPreferred &&
                                                !isUnavailable &&
                                                'text-green-600 border-green-200 bg-green-50',
                                              isAvoided &&
                                                !isUnavailable &&
                                                'text-red-600 border-red-200 bg-red-50',
                                              isUnavailable &&
                                                'text-gray-400 border-gray-200 opacity-50',
                                              !isPreferred &&
                                                !isAvoided &&
                                                !isUnavailable &&
                                                'text-gray-400 border-gray-200'
                                            )}
                                          >
                                            {label}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex justify-between">
                                    {driver.availableDays &&
                                    driver.availableDays.length > 0 ? (
                                      <div className="text-[10px] text-muted-foreground">
                                        Tage:{' '}
                                        {driver.availableDays
                                          .map(day => {
                                            const dayMap: Record<
                                              string,
                                              string
                                            > = {
                                              monday: 'Mo',
                                              tuesday: 'Di',
                                              wednesday: 'Mi',
                                              thursday: 'Do',
                                              friday: 'Fr',
                                              saturday: 'Sa',
                                              sunday: 'So',
                                            };
                                            return (
                                              dayMap[day.toLowerCase()] ||
                                              day.slice(0, 2)
                                            );
                                          })
                                          .join(', ')}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-muted-foreground">
                                        Alle Tage verfügbar
                                      </div>
                                    )}
                                    {date &&
                                      existingAssignments &&
                                      existingAssignments.some(
                                        a =>
                                          a.driverId === driver.id &&
                                          new Date(a.date).toDateString() ===
                                            new Date(date).toDateString() &&
                                          (shiftType
                                            ? a.shift !== shiftType
                                            : true)
                                      ) && (
                                        <div className="ml-auto">
                                          <Badge className="text-[9px] h-3 px-1 bg-blue-500">
                                            Bereits eingeplant
                                          </Badge>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="p-3 w-[250px]">
                              <div className="space-y-2">
                                <div className="font-medium">
                                  {driver.fullName}
                                </div>
                                {shiftType && (
                                  <div className="text-xs">
                                    <span className="font-medium">
                                      Übereinstimmung:
                                    </span>{' '}
                                    <span
                                      className={cn(
                                        scoreDriver(driver, shiftType) === 100
                                          ? 'text-blue-600 font-bold'
                                          : scoreDriver(driver, shiftType) >= 70
                                            ? 'text-green-600'
                                            : scoreDriver(driver, shiftType) >=
                                                40
                                              ? 'text-amber-600'
                                              : 'text-red-600'
                                      )}
                                    >
                                      {scoreDriver(driver, shiftType)}%
                                    </span>
                                  </div>
                                )}

                                <div className="text-xs space-y-1">
                                  <div>
                                    <span className="font-medium">
                                      Wöchentliche Stunden:
                                    </span>{' '}
                                    {driver.weeklyHours}
                                  </div>
                                  {driver.availableDays &&
                                    driver.availableDays.length > 0 && (
                                      <div>
                                        <span className="font-medium">
                                          Verfügbare Tage:
                                        </span>{' '}
                                        {driver.availableDays
                                          .map(day => {
                                            // Convert to German day names
                                            const dayMap: Record<
                                              string,
                                              string
                                            > = {
                                              monday: 'Montag',
                                              tuesday: 'Dienstag',
                                              wednesday: 'Mittwoch',
                                              thursday: 'Donnerstag',
                                              friday: 'Freitag',
                                              saturday: 'Samstag',
                                              sunday: 'Sonntag',
                                            };
                                            return (
                                              dayMap[day.toLowerCase()] || day
                                            );
                                          })
                                          .join(', ')}
                                      </div>
                                    )}
                                  <div>
                                    <span className="font-medium">
                                      Schichtpräferenzen:
                                    </span>{' '}
                                    <div className="flex gap-2 mt-1">
                                      {Object.values(ShiftType).map(shift => {
                                        const isPreferred =
                                          driver.hasShiftPreference(shift);
                                        const isAvoided =
                                          driver.avoidsShift(shift);
                                        const shiftName = SHIFT_NAMES[shift];
                                        const isUnavailable =
                                          date &&
                                          !driver.isAvailableOnDate(
                                            new Date(date)
                                          );

                                        return (
                                          <div
                                            key={`tooltip-${driver.id}-${shift}`}
                                            className="flex items-center gap-1"
                                          >
                                            <Badge
                                              className={cn(
                                                'text-xs px-2 py-0',
                                                isPreferred &&
                                                  !isUnavailable &&
                                                  'bg-green-100 text-green-800 hover:bg-green-100',
                                                isAvoided &&
                                                  !isUnavailable &&
                                                  'bg-red-100 text-red-800 hover:bg-red-100',
                                                isUnavailable &&
                                                  'bg-gray-100 text-gray-500 hover:bg-gray-100 opacity-60',
                                                !isPreferred &&
                                                  !isAvoided &&
                                                  !isUnavailable &&
                                                  'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                              )}
                                              variant="outline"
                                            >
                                              {shiftName}
                                              {isPreferred &&
                                                !isUnavailable &&
                                                ' ✓'}
                                              {isAvoided &&
                                                !isUnavailable &&
                                                ' ✗'}
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <span className="font-medium text-xs">
                                      Verfügbarkeit am{' '}
                                      {format(
                                        new Date(date || new Date()),
                                        'dd.MM.yyyy',
                                        { locale: de }
                                      )}
                                      :
                                    </span>{' '}
                                    <span
                                      className={cn(
                                        'text-xs',
                                        date &&
                                          driver.isAvailableOnDate(
                                            new Date(date)
                                          )
                                          ? 'text-green-600'
                                          : 'text-red-600 font-medium'
                                      )}
                                    >
                                      {date &&
                                      driver.isAvailableOnDate(new Date(date))
                                        ? 'Verfügbar'
                                        : 'Nicht verfügbar'}
                                    </span>
                                  </div>
                                  {driver.unavailableDates &&
                                    driver.unavailableDates.length > 0 && (
                                      <div className="mt-1">
                                        <span className="font-medium text-xs">
                                          Urlaubstage/Krankheitstage:
                                        </span>{' '}
                                        <span className="text-xs text-muted-foreground">
                                          {driver.unavailableDates.length} Tag
                                          {driver.unavailableDates.length !== 1
                                            ? 'e'
                                            : ''}
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
