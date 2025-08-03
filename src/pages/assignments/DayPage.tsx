import {useParams, useSearchParams, useNavigate, Link} from 'react-router-dom';

// German translations for shift types
const SHIFT_NAMES = {
    [ShiftType.MORNING]: "Früh",
    [ShiftType.AFTERNOON]: "Spät",
    [ShiftType.NIGHT]: "Nacht",
};

// Short codes for shift types (for badges)
const SHIFT_CODES = {
    [ShiftType.MORNING]: "F",
    [ShiftType.AFTERNOON]: "S",
    [ShiftType.NIGHT]: "N",
};
import {useState, useEffect} from 'react';
import {
    format,
    addDays,
    subDays,
    isToday,
    isTomorrow,
    isYesterday,
    differenceInDays,
    differenceInCalendarDays
} from 'date-fns';
import {de} from 'date-fns/locale';
import {useGetLines, useGetLine} from '@/api/queries/lines';
import {useGetBuses} from '@/api/queries/buses';
import {useGetDrivers} from '@/api/queries/drivers';
import {useCreateAssignment, useGetAssignmentsByDate, useDeleteAssignment} from '@/api/queries/assignments';
import {ScrollArea} from '@/components/ui/scroll-area';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {Separator} from '@/components/ui/separator';
import {ShiftType} from '@/models/entities/Driver';
import {Bus, BusSize, PropulsionType} from '@/models/entities/Bus';
import {Driver} from '@/models/entities/Driver';
import {User, Bus as BusIcon, Info, Battery, Ruler, CheckCircle, X, Plus, Save, Trash} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function DayPage() {
    const {date} = useParams<{ date: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const lineId = searchParams.get('lineId');
    const shiftType = searchParams.get('shift') as ShiftType | null;
    // Removed separate selection mode for bus/driver - we now select both at once
    const navigate = useNavigate();

    // Track selected buses and drivers for each shift
    const [selectedBuses, setSelectedBuses] = useState<Record<ShiftType, string | null>>({
        [ShiftType.MORNING]: null,
        [ShiftType.AFTERNOON]: null,
        [ShiftType.NIGHT]: null
    });

    const [selectedDrivers, setSelectedDrivers] = useState<Record<ShiftType, string | null>>({
        [ShiftType.MORNING]: null,
        [ShiftType.AFTERNOON]: null,
        [ShiftType.NIGHT]: null
    });

    // For temp selections during selection mode
    const [tempSelectedBus, setTempSelectedBus] = useState<string | null>(null);
    const [tempSelectedDriver, setTempSelectedDriver] = useState<string | null>(null);

    // Format date for display
    const formattedDate = date ? format(new Date(date), 'dd.MM.yyyy', {locale: de}) : '';

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
            [ShiftType.MORNING]: { start: '05:00', end: '13:00' },    // Early shift: 5:00 - 13:00
            [ShiftType.AFTERNOON]: { start: '13:00', end: '21:00' },  // Late shift: 13:00 - 21:00
            [ShiftType.NIGHT]: { start: '21:00', end: '05:00' }       // Night shift: 21:00 - 05:00 (next day)
        };

        const shiftRange = shiftRanges[shift];
        const lineStart = daySchedule.start;
        const lineEnd = daySchedule.end;

        // Convert time strings to minutes since midnight for easier comparison
        const timeToMinutes = (time: string): number => {
            const [hours, minutes] = time.split(':').map(Number);
            if (hours == undefined || minutes == undefined) throw new Error(
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
            const eveningOverlap = (lineStartMinutes < nightEnd && lineEndMinutes > nightStart);

            // Check overlap with early morning hours (00:00-05:00)
            const morningOverlap = (lineStartMinutes < earlyMorningEnd && lineEndMinutes > earlyMorningStart);

            return eveningOverlap || morningOverlap;
        } else {
            // Regular shifts: check for time range overlap
            return lineStartMinutes < shiftEndMinutes && lineEndMinutes > shiftStartMinutes;
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
                displayDay: format(tabDate, 'EEEE', {locale: de}),
                label: getDateLabel(tabDate),
                isActive: false
            });
        }

        // Add current date
        tabs.push({
            date: currentDate,
            dateString: format(currentDate, 'yyyy-MM-dd'),
            displayDate: format(currentDate, 'dd.MM.yyyy'),
            displayDay: format(currentDate, 'EEEE', {locale: de}),
            label: getDateLabel(currentDate),
            isActive: true
        });

        // Generate 5 days after current date
        for (let i = 1; i <= 5; i++) {
            const tabDate = addDays(currentDate, i);
            tabs.push({
                date: tabDate,
                dateString: format(tabDate, 'yyyy-MM-dd'),
                displayDate: format(tabDate, 'dd.MM.yyyy'),
                displayDay: format(tabDate, 'EEEE', {locale: de}),
                label: getDateLabel(tabDate),
                isActive: false
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
    const {data: lines, isLoading: isLoadingLines} = useGetLines();
    const {data: buses, isLoading: isLoadingBuses} = useGetBuses();
    const {data: drivers, isLoading: isLoadingDrivers} = useGetDrivers();

    // Fetch the selected line details if lineId is present
    const {data: selectedLine} = useGetLine(lineId || undefined);

    // Get the readable line name for display
    const selectedLineName = selectedLine ? `${selectedLine.lineNumber} - ${selectedLine.routeName}` : '';

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
            [ShiftType.NIGHT]: null
        });
        setSelectedDrivers({
            [ShiftType.MORNING]: null,
            [ShiftType.AFTERNOON]: null,
            [ShiftType.NIGHT]: null
        });

        // Set the search parameters to the new line ID
        setSearchParams({lineId: selectedLineId});
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
            setSearchParams({lineId: lineId || ''});
            return;
        }

        // Otherwise, set the shift for selection
        setSearchParams({
            lineId: lineId || '',
            shift: shift
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
        const hasBus = tempSelectedBus !== null || selectedBuses[shiftType] !== null;
        const hasDriver = tempSelectedDriver !== null || selectedDrivers[shiftType] !== null;

        return hasBus && hasDriver;
    };

    // Function to check if an assignment can be deleted
    const canDeleteAssignment = () => {
        if (!lineId || !shiftType || !date) return false;

        // Check if there's an existing assignment for this line, shift, and date
        const existingAssignment = existingAssignments?.find(
            assignment => 
                assignment.lineId === lineId && 
                assignment.shift === shiftType && 
                ( new Date(assignment.date).toISOString().split('T')[0] === date)
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
        const lineAssignments = existingAssignments?.filter(a => a.lineId === lineId) || [];

        // Check if all required shifts have both bus and driver assigned
        if (morningRequired) {
            const morningAssignment = lineAssignments.find(a => a.shift === ShiftType.MORNING);
            if (!morningAssignment || !morningAssignment.busId || !morningAssignment.driverId) return false;
        }

        if (afternoonRequired) {
            const afternoonAssignment = lineAssignments.find(a => a.shift === ShiftType.AFTERNOON);
            if (!afternoonAssignment || !afternoonAssignment.busId || !afternoonAssignment.driverId) return false;
        }

        if (nightRequired) {
            const nightAssignment = lineAssignments.find(a => a.shift === ShiftType.NIGHT);
            if (!nightAssignment || !nightAssignment.busId || !nightAssignment.driverId) return false;
        }

        // If we've made it here, all required shifts are assigned
        return (morningRequired || afternoonRequired || nightRequired);
    };

    // Function to check if any shifts are required for a line
    const hasRequiredShifts = (lineId: string): boolean => {
        if (!date) return false;

        // Get the line data
        const line = lines?.find(l => l.id === lineId);
        if (!line) return false;

        // Check if any shift is required
        return isShiftRequiredForLine(ShiftType.MORNING, line) || 
               isShiftRequiredForLine(ShiftType.AFTERNOON, line) || 
               isShiftRequiredForLine(ShiftType.NIGHT, line);
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
            [ShiftType.NIGHT]: { start: '21:00', end: '05:00' }
        };

        const shiftRange = shiftRanges[shift];
        const lineStart = daySchedule.start;
        const lineEnd = daySchedule.end;

        // Convert time strings to minutes since midnight for easier comparison
        const timeToMinutes = (time: string): number => {
            const [hours, minutes] = time.split(':').map(Number);
            if (hours == undefined || minutes == undefined ) throw new Error(
                `Invalid time format: ${time}`
            )
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
            const eveningOverlap = (lineStartMinutes < nightEnd && lineEndMinutes > nightStart);

            // Check overlap with early morning hours (00:00-05:00)
            const morningOverlap = (lineStartMinutes < earlyMorningEnd && lineEndMinutes > earlyMorningStart);

            return eveningOverlap || morningOverlap;
        } else {
            // Regular shifts: check for time range overlap
            return lineStartMinutes < shiftEndMinutes && lineEndMinutes > shiftStartMinutes;
        }
    };

    // Use the create and delete assignment mutations
    const createAssignmentMutation = useCreateAssignment();
    const deleteAssignmentMutation = useDeleteAssignment();

    // Get existing assignments for the selected date
    const {data: existingAssignments, isLoading: isLoadingAssignments} = useGetAssignmentsByDate(date);

    // Update selected buses and drivers when existing assignments are loaded
    useEffect(() => {
        if (existingAssignments && existingAssignments.length > 0 && lineId) {
            // Filter assignments for the current line
            const lineAssignments = existingAssignments.filter(assignment => assignment.lineId === lineId);

            // Create new state objects
            const newSelectedBuses = {...selectedBuses};
            const newSelectedDrivers = {...selectedDrivers};

            // Update state based on existing assignments
            lineAssignments.forEach(assignment => {
                newSelectedBuses[assignment.shift] = assignment.busId;
                newSelectedDrivers[assignment.shift] = assignment.driverId;
            });

            // Update state
            setSelectedBuses(newSelectedBuses);
            setSelectedDrivers(newSelectedDrivers);
        }
    }, [existingAssignments, lineId]);

    // Score drivers for the current shift and date
    const scoreDriver = (driver: Driver, shift: ShiftType): number => {
        if (!date) return 0;

        let score = 50; // Base score
        const currentDate = new Date(date);
        const weekday = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // Perfect match criteria counter
        let perfectMatchCriteria = 0;
        let totalCriteria = 0;

        // 1. Availability on the selected day is critical
        totalCriteria++;
        if (driver.availableDays && driver.availableDays.length > 0) {
            if (!driver.availableDays.includes(weekday)) {
                // Driver doesn't work on this day - critical issue
                score -= 70;
            } else {
                // Driver is explicitly available on this day
                perfectMatchCriteria++;
                score += 15;
            }
        } else {
            // Driver is available all days
            perfectMatchCriteria++;
            score += 5;
        }

        // 2. Check if driver is unavailable on this specific date (vacation, etc)
        totalCriteria++;
        if (driver.isAvailableOnDate && !driver.isAvailableOnDate(currentDate)) {
            // Severe penalty - practically disqualifying
            score -= 80;
        } else {
            perfectMatchCriteria++;
        }

        // 3. Check shift preference - major positive factor
        totalCriteria++;
        if (driver.hasShiftPreference && driver.hasShiftPreference(shift)) {
            perfectMatchCriteria++;
            score += 30; // Significant bonus
        }

        // 4. Check if driver avoids this shift - major negative factor
        totalCriteria++;
        if (driver.avoidsShift && driver.avoidsShift(shift)) {
            score -= 60; // Severe penalty
        } else {
            perfectMatchCriteria++;
        }

        // 5. Check for existing assignments on same day (different shift)
        totalCriteria++;
        const hasOtherShiftToday = existingAssignments?.some(a => 
            a.driverId === driver.id && 
            new Date(a.date).toDateString() === currentDate.toDateString() &&
            a.shift !== shift
        ) || false;

        if (hasOtherShiftToday) {
            // This could be good or bad depending on context
            // Here we treat it as positive for continuity
            perfectMatchCriteria++;
            score += 20;
        }

        // Perfect match bonus - if all criteria are met, ensure score can reach 100
        if (perfectMatchCriteria === totalCriteria) {
            score += (100 - score); // Boost to 100% for perfect matches
        }

        // Add a small random factor to differentiate otherwise equal scores (0-2 points)
        if (perfectMatchCriteria !== totalCriteria) { // Don't add randomness to perfect scores
            score += Math.floor(Math.random() * 3);
        }

        return Math.max(0, Math.min(100, Math.round(score))); // Round and clamp between 0-100
    };

    // Sort drivers based on their score for the current shift
    const getSortedDrivers = (): Driver[] => {
        if (!drivers || !shiftType) return drivers || [];

        return [...drivers].sort((a, b) => {
            const scoreA = scoreDriver(a, shiftType);
            const scoreB = scoreDriver(b, shiftType);
            return scoreB - scoreA; // Descending order (highest score first)
        });
    };

    // Get opacity level based on driver score
    const getDriverOpacity = (driver: Driver): string => {
        if (!shiftType) return "";

        const score = scoreDriver(driver, shiftType);
        if (score >= 70) return ""; // Full opacity for good matches
        if (score >= 40) return "opacity-70";
        if (score >= 20) return "opacity-50";
        return "opacity-30"; // Very poor matches
    };

    // Function to delete the current assignment
    const handleDeleteAssignment = () => {
        if (!lineId || !shiftType || !date) return;

        // Find the existing assignment
        const existingAssignment = existingAssignments?.find(
            assignment => 
                assignment.lineId === lineId && 
                assignment.shift === shiftType && 
                (new Date(assignment.date).toISOString().split('T')[0] === date)
        );

        if (existingAssignment) {
            deleteAssignmentMutation.mutate(existingAssignment.id, {
                onSuccess: () => {
                    // Clear selections after successful deletion
                    setSelectedBuses(prev => ({
                        ...prev,
                        [shiftType]: null
                    }));
                    setSelectedDrivers(prev => ({
                        ...prev,
                        [shiftType]: null
                    }));
                    setTempSelectedBus(null);
                    setTempSelectedDriver(null);
                }
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
            [shiftType]: busId
        }));

        setSelectedDrivers(prev => ({
            ...prev,
            [shiftType]: driverId
        }));

        // Create and save the assignment using the mutation
        createAssignmentMutation.mutate({
            date: date,
            shift: shiftType,
            lineId: lineId,
            busId: busId,
            driverId: driverId
        }, {
            onSuccess: (result) => {
                console.log('Assignment saved successfully:', result);
                // Exit selection mode
                setSearchParams({lineId: lineId || ''});

                // Reset temporary selections
                setTempSelectedBus(null);
                setTempSelectedDriver(null);
            },
            onError: (error) => {
                console.error('Error saving assignment:', error);
                // You could display an error message to the user here
            }
        });
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
                                    disabled={!canSaveAssignment() || createAssignmentMutation.isPending}
                                    className="flex gap-2 items-center"
                                    onClick={saveAssignment}
                                    variant={canSaveAssignment() ? "default" : "outline"}
                                >
                                    <Save className="h-4 w-4"/>
                                    {createAssignmentMutation.isPending ? 'Speichere...' : 'Speichern'}
                                </Button>
                                <Button
                                    onClick={handleDeleteAssignment}
                                    disabled={!canDeleteAssignment() || deleteAssignmentMutation.isPending}
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
                        {dateTabs.map((tab) => (
                            <Link
                                key={tab.dateString}
                                to={`/assignments/day/${tab.dateString}${lineId ? `?lineId=${lineId}` : ''}`}
                                className="flex-shrink-0"
                            >
                                <div
                                    className={cn(
                                        "p-3 rounded-lg border text-center min-w-[120px] transition-all hover:bg-muted/50",
                                        tab.isActive
                                            ? "bg-muted shadow-sm"
                                            : "bg-background border-border hover:border-muted-foreground/30"
                                    )}
                                >
                                    <div className="text-sm font-medium">
                                        {tab.label}
                                    </div>
                                    <div className="text-xs">
                                        {tab.displayDate}
                                    </div>
                                    <div className="text-xs capitalize">
                                        {tab.displayDay}
                                    </div>
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
                                <p className="text-center text-muted-foreground py-8">Wird geladen...</p>
                            ) : (
                                lines?.map((line, index) => {
                                    // Check if line is inactive or has no shifts needed today
                                    const isInactiveOrNoShifts = !line.isActive || !line.operatesOnDate(date ? new Date(date) : new Date());
                                    const isFullyAssigned = isLineFullyAssigned(line.id);
                                    const hasShifts = hasRequiredShifts(line.id);

                                    return (
                                        <div key={line.id} className="w-full">
                                            <button
                                                onClick={() => handleLineSelect(line.id)}
                                                className={cn(
                                                    "w-full p-3 text-center rounded-lg border text-sm transition-all",
                                                    lineId === line.id
                                                        ? "bg-muted shadow-sm"
                                                        : "bg-background border-border hover:border-muted-foreground/30",
                                                    isInactiveOrNoShifts
                                                        ? "opacity-40 hover:opacity-60"
                                                        : "hover:bg-muted/50"
                                                )}
                                            >
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className={cn(
                                                        "font-medium",
                                                        isInactiveOrNoShifts && "text-muted-foreground"
                                                    )}>{line.lineNumber}</div>
                                                    {!isInactiveOrNoShifts && hasShifts && (
                                                        isFullyAssigned ? (
                                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                                        ) : (
                                                            <X className="h-3 w-3 text-red-500" />
                                                        )
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground break-words">{line.routeName}</div>
                                            </button>
                                        </div>
                                    );
                                })
                            )}

                            {!isLoadingLines && (!lines || lines.length === 0) && (
                                <p className="text-center text-muted-foreground py-8">Keine Linien vorhanden</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Column 2: Middle column with line details and shifts */}
                <div className="lg:col-span-1">
                    <div className="flex flex-col gap-3 h-full">
                        {/* Line Details - Fixed height */}
                        <Card className="flex-shrink-0">
                            <CardHeader className="p-3">
                                <CardTitle className="text-sm">Details</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3">
                                {lineId && selectedLine ? (
                                    <div className="space-y-2">
                                        <div>
                                            <h3 className="font-medium text-sm">Linie {selectedLine.lineNumber}</h3>
                                            <p className="text-xs text-muted-foreground">{selectedLine.routeName}</p>
                                        </div>
                                        <div className="flex gap-4 text-xs">
                                            <span><span
                                                className="font-medium">Distanz:</span> {selectedLine.distanceKm} km</span>
                                            <span><span
                                                className="font-medium">Dauer:</span> {selectedLine.durationMinutes} min</span>
                                        </div>
                                        {date && selectedLine && (
                                            <div className="text-xs">
                                                {(() => {
                                                    const currentDate = new Date(date);
                                                    const dayOfWeek = currentDate
                                                        .toLocaleDateString('en-US', { weekday: 'long' })
                                                        .toLowerCase() as keyof typeof selectedLine.weeklySchedule;
                                                    const daySchedule = selectedLine.weeklySchedule[dayOfWeek];

                                                    if (daySchedule) {
                                                        return (
                                                            <div className="text-xs">
                                                                <span className="font-medium">Betriebszeiten:</span> {daySchedule.start} - {daySchedule.end}
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <div className="text-xs text-muted-foreground">
                                                                Kein Betrieb heute
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-4 text-xs">Wählen Sie eine Linie
                                        aus</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Shifts - Compact layout */}
                        <div className="flex flex-col gap-3">
                            {/* Morning Shift */}
                            <Card
                                className={cn(
                                    "flex-shrink-0 h-auto",
                                    shiftType === ShiftType.MORNING && "border-blue-500 border-2",
                                    lineId && isShiftRequired(ShiftType.MORNING) && "cursor-pointer hover:bg-muted/50 transition-colors",
                                    lineId && !isShiftRequired(ShiftType.MORNING) && "opacity-40"
                                )}
                                onClick={() => {
                                    if (lineId && isShiftRequired(ShiftType.MORNING)) {
                                        handleShiftSelect(ShiftType.MORNING);
                                    }
                                }}
                            >
                                <CardHeader className="flex-shrink-0 p-3">
                                    <CardTitle className={cn(
                                        "text-sm flex items-center justify-between",
                                        lineId && !isShiftRequired(ShiftType.MORNING) && "text-muted-foreground"
                                    )}>
                                        <span>{SHIFT_NAMES[ShiftType.MORNING]} (05:00-13:00)</span>
                                        {lineId && isShiftRequired(ShiftType.MORNING) && (
                                            isShiftComplete(ShiftType.MORNING) ? (
                                                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                            ) : (
                                                <X className="h-4 w-4 text-red-500 ml-2" />
                                            )
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 min-h-0 p-3">
                                    {lineId && selectedLine ? (
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">Bus:</span>
                                                <span
                                                    className={selectedBuses[ShiftType.MORNING] ? "" : "text-muted-foreground"}>
                                                    {selectedBuses[ShiftType.MORNING] ? getBusName(selectedBuses[ShiftType.MORNING]) : 'Nicht zugewiesen'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">Fahrer:</span>
                                                <span
                                                    className={selectedDrivers[ShiftType.MORNING] ? "" : "text-muted-foreground"}>
                                                    {selectedDrivers[ShiftType.MORNING] ? getDriverName(selectedDrivers[ShiftType.MORNING]) : 'Nicht zugewiesen'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground text-xs">Wählen Sie eine Linie
                                            aus</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Afternoon Shift */}
                            <Card
                                className={cn(
                                    "flex-shrink-0 h-auto",
                                    shiftType === ShiftType.AFTERNOON && "border-blue-500 border-2",
                                    lineId && isShiftRequired(ShiftType.AFTERNOON) && "cursor-pointer hover:bg-muted/50 transition-colors",
                                    lineId && !isShiftRequired(ShiftType.AFTERNOON) && "opacity-40"
                                )}
                                onClick={() => {
                                    if (lineId && isShiftRequired(ShiftType.AFTERNOON)) {
                                        handleShiftSelect(ShiftType.AFTERNOON);
                                    }
                                }}
                            >
                                <CardHeader className="flex-shrink-0 p-3">
                                    <CardTitle className={cn(
                                        "text-sm flex items-center justify-between",
                                        lineId && !isShiftRequired(ShiftType.AFTERNOON) && "text-muted-foreground"
                                    )}>
                                        <span>{SHIFT_NAMES[ShiftType.AFTERNOON]} (13:00-21:00)</span>
                                        {lineId && isShiftRequired(ShiftType.AFTERNOON) && (
                                            isShiftComplete(ShiftType.AFTERNOON) ? (
                                                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                            ) : (
                                                <X className="h-4 w-4 text-red-500 ml-2" />
                                            )
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 min-h-0 p-3">
                                    {lineId && selectedLine ? (
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">Bus:</span>
                                                <span
                                                    className={selectedBuses[ShiftType.AFTERNOON] ? "" : "text-muted-foreground"}>
                                                    {selectedBuses[ShiftType.AFTERNOON] ? getBusName(selectedBuses[ShiftType.AFTERNOON]) : 'Nicht zugewiesen'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">Fahrer:</span>
                                                <span
                                                    className={selectedDrivers[ShiftType.AFTERNOON] ? "" : "text-muted-foreground"}>
                                                    {selectedDrivers[ShiftType.AFTERNOON] ? getDriverName(selectedDrivers[ShiftType.AFTERNOON]) : 'Nicht zugewiesen'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground text-xs">Wählen Sie eine Linie
                                            aus</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Night Shift */}
                            <Card
                                className={cn(
                                    "flex-shrink-0 h-auto",
                                    shiftType === ShiftType.NIGHT && "border-blue-500 border-2",
                                    lineId && isShiftRequired(ShiftType.NIGHT) && "cursor-pointer hover:bg-muted/50 transition-colors",
                                    lineId && !isShiftRequired(ShiftType.NIGHT) && "opacity-40"
                                )}
                                onClick={() => {
                                    if (lineId && isShiftRequired(ShiftType.NIGHT)) {
                                        handleShiftSelect(ShiftType.NIGHT);
                                    }
                                }}
                            >
                                <CardHeader className="flex-shrink-0 p-3">
                                    <CardTitle className={cn(
                                        "text-sm flex items-center justify-between",
                                        lineId && !isShiftRequired(ShiftType.NIGHT) && "text-muted-foreground"
                                    )}>
                                        <span>{SHIFT_NAMES[ShiftType.NIGHT]} (21:00-05:00)</span>
                                        {lineId && isShiftRequired(ShiftType.NIGHT) && (
                                            isShiftComplete(ShiftType.NIGHT) ? (
                                                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                            ) : (
                                                <X className="h-4 w-4 text-red-500 ml-2" />
                                            )
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 min-h-0 p-3">
                                    {lineId && selectedLine ? (
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">Bus:</span>
                                                <span
                                                    className={selectedBuses[ShiftType.NIGHT] ? "" : "text-muted-foreground"}>
                                                    {selectedBuses[ShiftType.NIGHT] ? getBusName(selectedBuses[ShiftType.NIGHT]) : 'Nicht zugewiesen'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">Fahrer:</span>
                                                <span
                                                    className={selectedDrivers[ShiftType.NIGHT] ? "" : "text-muted-foreground"}>
                                                    {selectedDrivers[ShiftType.NIGHT] ? getDriverName(selectedDrivers[ShiftType.NIGHT]) : 'Nicht zugewiesen'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground text-xs">Wählen Sie eine Linie
                                            aus</p>
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
                                        <BusIcon className="h-4 w-4 mr-1"/>
                                        <span>Busse</span>
                                    </div>
                                    {isSelectionMode ? (
                                        <span
                                            className="text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                                            Auswahl aktiv
                                        </span>
                                    ) : (<span
                                      className="text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                                            Auswahl inaktiv
                                        </span>)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 p-2">
                                <ScrollArea className="h-full">
                                    {isLoadingBuses ? (
                                        <p className="text-center text-muted-foreground py-8">Wird geladen...</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                            {buses?.map((bus: Bus) => (
                                                <div
                                                    key={bus.id}
                                                    className={cn(
                                                        "p-2 border rounded-md hover:bg-muted/50 flex flex-col h-20 transition-all",
                                                        isSelectionMode && shiftType ? "cursor-pointer" : "",
                                                        tempSelectedBus === bus.id && "border-blue-500 border-2 bg-blue-50/50",
                                                        shiftType && selectedBuses[shiftType] === bus.id && "border-green-500 border-2 bg-green-50/50"
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
                                                        <p className="font-medium text-sm truncate">{bus.licensePlate}</p>
                                                        <Badge
                                                            variant={bus.propulsionType === PropulsionType.ELECTRIC ? "default" : "secondary"}
                                                            className="text-xs h-4"
                                                        >
                                                            {bus.propulsionType === PropulsionType.ELECTRIC ? "Elektro" : "Diesel"}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <div
                                                            className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span>
                                                                {bus.size === BusSize.SMALL ? "Klein" : 
                                                                 bus.size === BusSize.MEDIUM ? "Mittel" : 
                                                                 bus.size === BusSize.LARGE ? "Groß" : 
                                                                 bus.size === BusSize.ARTICULATED ? "Gelenkbus" : bus.size}
                                                            </span>
                                                            {bus.propulsionType === PropulsionType.ELECTRIC && (
                                                                <span>{bus.maxRangeKm || "--"} km</span>
                                                            )}
                                                        </div>

                                                        {(tempSelectedBus === bus.id || (shiftType && selectedBuses[shiftType] === bus.id)) && (
                                                            <CheckCircle className={cn(
                                                                "h-4 w-4",
                                                                tempSelectedBus === bus.id ? "text-blue-500" : "text-green-500"
                                                            )}/>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Drivers Section - Fixed height */}
                        <Card className="h-[37vh] flex flex-col">
                            <CardHeader className="flex-shrink-0 p-3">
                                <CardTitle className="text-sm flex items-center justify-between">
                                    <div className="flex items-center">
                                        <User className="h-4 w-4 mr-1"/>
                                        <span>Fahrer</span>
                                    </div>
                                    {isSelectionMode && (
                                        <span
                                            className="text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                                            Auswahl aktiv
                                        </span>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 min-h-0 p-2">
                                <ScrollArea className="h-full">
                                    {isLoadingDrivers ? (
                                        <p className="text-center text-muted-foreground py-8">Wird geladen...</p>
                                    ) : (
                                        <TooltipProvider>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                            {getSortedDrivers().map((driver: Driver) => (
                                                <Tooltip key={driver.id}>
                                                <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        "p-2 border rounded-md hover:bg-muted/50 flex flex-col h-20 transition-all",
                                                        isSelectionMode && shiftType ? "cursor-pointer" : "",
                                                        tempSelectedDriver === driver.id && "border-blue-500 border-2 bg-blue-50/50",
                                                        shiftType && selectedDrivers[shiftType] === driver.id && "border-green-500 border-2 bg-green-50/50",
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
                                                        <p className="font-medium text-sm truncate">{driver.fullName}</p>
                                                        <div className="flex gap-1 items-center">
                                                            {shiftType && (
                                                                <Badge 
                                                                    variant="outline" 
                                                                    className={cn(
                                                                        "h-3 text-[9px] px-1",
                                                                        scoreDriver(driver, shiftType) === 100 ? "text-blue-600 border-blue-200 bg-blue-50" :
                                                                        scoreDriver(driver, shiftType) >= 70 ? "text-green-600 border-green-200 bg-green-50" :
                                                                        scoreDriver(driver, shiftType) >= 40 ? "text-amber-600 border-amber-200 bg-amber-50" :
                                                                        "text-red-600 border-red-200 bg-red-50"
                                                                    )}
                                                                >
                                                                    {scoreDriver(driver, shiftType)}%
                                                                </Badge>
                                                            )}
                                                            {shiftType && driver.hasShiftPreference && driver.hasShiftPreference(shiftType) && (
                                                                <Badge variant="outline" className="h-3 text-[9px] px-1 text-green-600 border-green-200 bg-green-50">
                                                                    Bevorzugt
                                                                </Badge>
                                                            )}
                                                            {shiftType && driver.avoidsShift && driver.avoidsShift(shiftType) && (
                                                                <Badge variant="outline" className="h-3 text-[9px] px-1 text-red-600 border-red-200 bg-red-50">
                                                                    Vermeidet
                                                                </Badge>
                                                            )}
                                                            {(tempSelectedDriver === driver.id || (shiftType && selectedDrivers[shiftType] === driver.id)) && (
                                                                <CheckCircle className={cn(
                                                                    "h-4 w-4",
                                                                    tempSelectedDriver === driver.id ? "text-blue-500" : "text-green-500"
                                                                )}/>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground">{driver.weeklyHours} Std/Woche</span>

                                                            <div className="flex gap-1">
                                                                {/* Always show all three shift types */}
                                                                {Object.values(ShiftType).map((shift) => {
                                                                    const isPreferred = driver.hasShiftPreference(shift);
                                                                    const isAvoided = driver.avoidsShift(shift);

                                                                    // Get the badge label from the constant
                                                                    const label = SHIFT_CODES[shift];

                                                                    return (
                                                                        <Badge 
                                                                            key={`${driver.id}-shift-${shift}`}
                                                                            variant="outline"
                                                                            className={cn(
                                                                                "text-[10px] h-3 px-1",
                                                                                isPreferred && "text-green-600 border-green-200 bg-green-50",
                                                                                isAvoided && "text-red-600 border-red-200 bg-red-50",
                                                                                !isPreferred && !isAvoided && "text-gray-400 border-gray-200"
                                                                            )}
                                                                        >
                                                                            {label}
                                                                        </Badge>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            {driver.availableDays && driver.availableDays.length > 0 ? (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    Tage: {driver.availableDays.map(day => {
                                                                        const dayMap: Record<string, string> = {
                                                                            'monday': 'Mo',
                                                                            'tuesday': 'Di',
                                                                            'wednesday': 'Mi',
                                                                            'thursday': 'Do',
                                                                            'friday': 'Fr',
                                                                            'saturday': 'Sa',
                                                                            'sunday': 'So'
                                                                        };
                                                                        return dayMap[day.toLowerCase()] || day.slice(0, 2);
                                                                    }).join(', ')}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    Alle Tage verfügbar
                                                                </div>
                                                            )}
                                                            {date && driver.isAvailableOnDate && !driver.isAvailableOnDate(new Date(date)) && (
                                                                <Badge className="text-[9px] h-3 px-1 bg-red-500">
                                                                    Nicht verfügbar
                                                                </Badge>
                                                            )}
                                                            {date && existingAssignments && existingAssignments.some(a => 
                                                                a.driverId === driver.id && 
                                                                new Date(a.date).toDateString() === new Date(date).toDateString() &&
                                                                (shiftType ? a.shift !== shiftType : true)
                                                            ) && (
                                                                <Badge className="text-[9px] h-3 px-1 bg-blue-500">
                                                                    Bereits eingeplant
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-3 w-[250px]">
                                                    <div className="space-y-2">
                                                        <div className="font-medium">{driver.fullName}</div>
                                                        {shiftType && (
                                                            <div className="text-xs">
                                                                <span className="font-medium">Übereinstimmung:</span>{' '}
                                                                <span className={cn(
                                                                    scoreDriver(driver, shiftType) === 100 ? "text-blue-600 font-bold" :
                                                                    scoreDriver(driver, shiftType) >= 70 ? "text-green-600" :
                                                                    scoreDriver(driver, shiftType) >= 40 ? "text-amber-600" :
                                                                    "text-red-600"
                                                                )}>
                                                                    {scoreDriver(driver, shiftType)}%
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="text-xs space-y-1">
                                                            <div><span className="font-medium">Wöchentliche Stunden:</span> {driver.weeklyHours}</div>
                                                            {driver.availableDays && driver.availableDays.length > 0 && (
                                                                <div>
                                                                    <span className="font-medium">Verfügbare Tage:</span>{' '}
                                                                    {driver.availableDays.map(day => {
                                                                        // Convert to German day names
                                                                        const dayMap: Record<string, string> = {
                                                                            'monday': 'Montag',
                                                                            'tuesday': 'Dienstag',
                                                                            'wednesday': 'Mittwoch',
                                                                            'thursday': 'Donnerstag',
                                                                            'friday': 'Freitag',
                                                                            'saturday': 'Samstag',
                                                                            'sunday': 'Sonntag'
                                                                        };
                                                                        return dayMap[day.toLowerCase()] || day;
                                                                    }).join(', ')}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="font-medium">Schichtpräferenzen:</span>{' '}
                                                                <div className="flex gap-2 mt-1">
                                                                    {Object.values(ShiftType).map(shift => {
                                                                        const isPreferred = driver.hasShiftPreference(shift);
                                                                        const isAvoided = driver.avoidsShift(shift);
                                                                                                                                                                const shiftName = SHIFT_NAMES[shift];

                                                                        return (
                                                                            <div key={`tooltip-${driver.id}-${shift}`} className="flex items-center gap-1">
                                                                                <Badge 
                                                                                    className={cn(
                                                                                        "text-xs px-2 py-0",
                                                                                        isPreferred && "bg-green-100 text-green-800 hover:bg-green-100",
                                                                                        isAvoided && "bg-red-100 text-red-800 hover:bg-red-100",
                                                                                        !isPreferred && !isAvoided && "bg-gray-100 text-gray-800 hover:bg-gray-100"
                                                                                    )}
                                                                                    variant="outline"
                                                                                >
                                                                                    {shiftName}
                                                                                    {isPreferred && " ✓"}
                                                                                    {isAvoided && " ✗"}
                                                                                </Badge>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
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