import {useParams, useSearchParams, useNavigate, Link} from 'react-router-dom';
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
import {useCreateAssignment, useGetAssignmentsByDate} from '@/api/queries/assignments';
import {ScrollArea} from '@/components/ui/scroll-area';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {Separator} from '@/components/ui/separator';
import {ShiftType} from '@/models/entities/Driver';
import {Bus, BusSize, PropulsionType} from '@/models/entities/Bus';
import {Driver} from '@/models/entities/Driver';
import {User, Bus as BusIcon, Info, Battery, Ruler, CheckCircle, X, Plus, Save} from 'lucide-react';

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
        return `${diff > 0 ? '+' : ''}${diff}`;
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

    // Use the create assignment mutation
    const createAssignmentMutation = useCreateAssignment();

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

                    {isSelectionMode && shiftType && (
                        <div className="flex flex-col items-end gap-1">
                            <div className="text-xs font-medium">
                                {`Bus ${tempSelectedBus ? '✓' : ''} und Fahrer ${tempSelectedDriver ? '✓' : ''} auswählen`}
                            </div>
                            <Button
                                disabled={!canSaveAssignment()}
                                className="flex gap-2 items-center"
                                onClick={saveAssignment}
                                variant={canSaveAssignment() ? "default" : "outline"}
                            >
                                <Save className="h-4 w-4"/>
                                {canSaveAssignment() ? 'Zuweisung speichern' : 'Bus und Fahrer benötigt'}
                            </Button>
                        </div>
                    )}
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
                                <p className="text-center text-muted-foreground py-8">Laden...</p>
                            ) : (
                                lines?.map((line, index) => (
                                    <div key={line.id} className="w-full">
                                        <button
                                            onClick={() => handleLineSelect(line.id)}
                                            className={cn(
                                                "w-full p-3 text-center rounded-lg border text-sm transition-all hover:bg-muted/50",
                                                lineId === line.id
                                                    ? "bg-muted shadow-sm"
                                                    : "bg-background border-border hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <div className="font-medium">{line.lineNumber}</div>
                                            <div
                                                className="text-xs text-muted-foreground break-words">{line.routeName}</div>
                                        </button>
                                    </div>
                                ))
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
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-4 text-xs">Wählen Sie eine Linie
                                        aus</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Shifts - Flexible height */}
                        <div className="flex-1 min-h-0 flex flex-col gap-3">
                            {/* Morning Shift */}
                            <Card
                                className={cn(
                                    "flex-1 min-h-0",
                                    shiftType === ShiftType.MORNING && "border-blue-500 border-2",
                                    selectedBuses[ShiftType.MORNING] && selectedDrivers[ShiftType.MORNING] && "border-green-500 border-2",
                                    (selectedBuses[ShiftType.MORNING] || selectedDrivers[ShiftType.MORNING]) && !(selectedBuses[ShiftType.MORNING] && selectedDrivers[ShiftType.MORNING]) && "border-yellow-500 border-2",
                                    lineId && "cursor-pointer hover:bg-muted/50 transition-colors"
                                )}
                                onClick={() => {
                                    if (lineId) {
                                        handleShiftSelect(ShiftType.MORNING);
                                    }
                                }}
                            >
                                <CardHeader className="flex-shrink-0 p-3">
                                    <CardTitle className="text-sm">Früh</CardTitle>
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
                                    "flex-1 min-h-0",
                                    shiftType === ShiftType.AFTERNOON && "border-blue-500 border-2",
                                    selectedBuses[ShiftType.AFTERNOON] && selectedDrivers[ShiftType.AFTERNOON] && "border-green-500 border-2",
                                    (selectedBuses[ShiftType.AFTERNOON] || selectedDrivers[ShiftType.AFTERNOON]) && !(selectedBuses[ShiftType.AFTERNOON] && selectedDrivers[ShiftType.AFTERNOON]) && "border-yellow-500 border-2",
                                    lineId && "cursor-pointer hover:bg-muted/50 transition-colors"
                                )}
                                onClick={() => {
                                    if (lineId) {
                                        handleShiftSelect(ShiftType.AFTERNOON);
                                    }
                                }}
                            >
                                <CardHeader className="flex-shrink-0 p-3">
                                    <CardTitle className="text-sm">Mittag</CardTitle>
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
                                    "flex-1 min-h-0",
                                    shiftType === ShiftType.NIGHT && "border-blue-500 border-2",
                                    selectedBuses[ShiftType.NIGHT] && selectedDrivers[ShiftType.NIGHT] && "border-green-500 border-2",
                                    (selectedBuses[ShiftType.NIGHT] || selectedDrivers[ShiftType.NIGHT]) && !(selectedBuses[ShiftType.NIGHT] && selectedDrivers[ShiftType.NIGHT]) && "border-yellow-500 border-2",
                                    lineId && "cursor-pointer hover:bg-muted/50 transition-colors"
                                )}
                                onClick={() => {
                                    if (lineId) {
                                        handleShiftSelect(ShiftType.NIGHT);
                                    }
                                }}
                            >
                                <CardHeader className="flex-shrink-0 p-3">
                                    <CardTitle className="text-sm">Nacht</CardTitle>
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
                        <Card className="h-[39vh] flex flex-col">
                            <CardHeader className="flex-shrink-0 p-3">
                                <CardTitle className="text-sm flex items-center justify-between">
                                    <div className="flex items-center">
                                        <BusIcon className="h-4 w-4 mr-1"/>
                                        <span>Busse</span>
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
                                    {isLoadingBuses ? (
                                        <p className="text-center text-muted-foreground py-8">Laden...</p>
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
                                                            {bus.propulsionType === PropulsionType.ELECTRIC ? "E" : "D"}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <div
                                                            className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="capitalize">{bus.size}</span>
                                                            {bus.propulsionType === PropulsionType.ELECTRIC && bus.maxRangeKm && (
                                                                <span>{bus.maxRangeKm} km</span>
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
                        <Card className="h-[39vh] flex flex-col">
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
                                        <p className="text-center text-muted-foreground py-8">Laden...</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                            {drivers?.map((driver: Driver) => (
                                                <div
                                                    key={driver.id}
                                                    className={cn(
                                                        "p-2 border rounded-md hover:bg-muted/50 flex flex-col h-20 transition-all",
                                                        isSelectionMode && shiftType ? "cursor-pointer" : "",
                                                        tempSelectedDriver === driver.id && "border-blue-500 border-2 bg-blue-50/50",
                                                        shiftType && selectedDrivers[shiftType] === driver.id && "border-green-500 border-2 bg-green-50/50"
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
                                                        {(tempSelectedDriver === driver.id || (shiftType && selectedDrivers[shiftType] === driver.id)) && (
                                                            <CheckCircle className={cn(
                                                                "h-4 w-4",
                                                                tempSelectedDriver === driver.id ? "text-blue-500" : "text-green-500"
                                                            )}/>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between mt-1">
                                                        <span
                                                            className="text-xs text-muted-foreground">{driver.weeklyHours} Std/Woche</span>

                                                        {driver.preferredShifts && driver.preferredShifts.length > 0 && (
                                                            <div className="flex gap-1">
                                                                {driver.preferredShifts.slice(0, 2).map((shift, index) => (
                                                                    <Badge key={`${driver.id}-${shift}-${index}`}
                                                                           variant="outline"
                                                                           className="text-[10px] h-3 px-1">
                                                                        {shift.charAt(0)}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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