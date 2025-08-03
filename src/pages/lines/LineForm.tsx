import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line, WeeklySchedule, TimeSchedule } from '@/models/entities/Line';
import { BusSize } from '@/models/entities/Bus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGetLine, useCreateLine, useUpdateLine } from '@/api/queries/lines';

const WEEKDAYS = [
  { value: 'monday', label: 'Montag' },
  { value: 'tuesday', label: 'Dienstag' },
  { value: 'wednesday', label: 'Mittwoch' },
  { value: 'thursday', label: 'Donnerstag' },
  { value: 'friday', label: 'Freitag' },
  { value: 'saturday', label: 'Samstag' },
  { value: 'sunday', label: 'Sonntag' },
];

export function LineForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Default line state for new line
  const defaultLine: Partial<Line> = {
    lineNumber: '',
    routeName: '',
    distanceKm: 0,
    durationMinutes: 0,
    compatibleBusSizes: [],
    weeklySchedule: {},
    isActive: true,
  };

  // State to track form changes
  const [line, setLine] = useState<Partial<Line>>(defaultLine);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Fetch line data with centralized query hook
  const { 
    data: fetchedLine,
    isLoading: isFetchLoading,
    error: fetchError
  } = useGetLine(id);

  // Use centralized mutation hooks
  const createLineMutation = useCreateLine();
  const updateLineMutation = useUpdateLine(id);

  // Update form data when fetched data changes
  useEffect(() => {
    if (fetchedLine) {
      setLine({
        ...defaultLine,  // Ensure all defaults are set first
        ...fetchedLine,  // Then override with fetched data
        // Ensure arrays and objects are never undefined
        compatibleBusSizes: fetchedLine.compatibleBusSizes || [],
        weeklySchedule: fetchedLine.weeklySchedule || {},
        isActive: fetchedLine.isActive !== undefined ? fetchedLine.isActive : true,
      });
    }
  }, [fetchedLine]);

  // Extract selected days from weeklySchedule
  useEffect(() => {
    if (line.weeklySchedule) {
      setSelectedDays(Object.keys(line.weeklySchedule));
    }
  }, [line.weeklySchedule]);

  // Combined loading state
  const isLoading = isFetchLoading || createLineMutation.isPending || updateLineMutation.isPending;

  // Combined error state
  const error = fetchError || createLineMutation.error || updateLineMutation.error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (id && id !== 'new') {
      updateLineMutation.mutate(line, {
        onSuccess: () => {
          navigate('/lines');
        }
      });
    } else {
      createLineMutation.mutate(line, {
        onSuccess: () => {
          navigate('/lines');
        }
      });
    }
  };

  const handleChange = (field: keyof Line, value: any) => {
    setLine(prev => ({ ...prev, [field]: value }));
  };

  const handleBusSizeChange = (size: BusSize, checked: boolean) => {
    const currentSizes = [...(line.compatibleBusSizes || [])];
    if (checked) {
      handleChange('compatibleBusSizes', [...currentSizes, size]);
    } else {
      handleChange(
        'compatibleBusSizes',
        currentSizes.filter(s => s !== size)
      );
    }
  };

  const handleDayChange = (day: string, checked: boolean) => {
    // Update the selected days
    let newSelectedDays;
    if (checked) {
      newSelectedDays = [...selectedDays, day];
    } else {
      newSelectedDays = selectedDays.filter(d => d !== day);
    }
    setSelectedDays(newSelectedDays);

    // Update the weekly schedule
    const newSchedule = { ...line.weeklySchedule } as WeeklySchedule;
    if (checked) {
      // Add a default time schedule for this day
      newSchedule[day as keyof WeeklySchedule] = {
        start: '08:00',
        end: '18:00',
      };
    } else {
      // Remove this day from the schedule
      delete newSchedule[day as keyof WeeklySchedule];
    }
    handleChange('weeklySchedule', newSchedule);
  };

  const handleTimeChange = (
    day: string,
    field: keyof TimeSchedule,
    value: string
  ) => {
    const schedule = { ...line.weeklySchedule } as WeeklySchedule;
    const daySchedule = schedule[day as keyof WeeklySchedule] || {
      start: '08:00',
      end: '18:00',
    };
    schedule[day as keyof WeeklySchedule] = { ...daySchedule, [field]: value };
    handleChange('weeklySchedule', schedule);
  };

  if (isLoading && id && id !== 'new') {
    return <div className="text-center py-10">Linie wird geladen...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {id && id !== 'new' ? 'Linie bearbeiten' : 'Neue Linie'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lineNumber">Liniennummer</Label>
              <Input
                id="lineNumber"
                value={line.lineNumber || ''}
                onChange={e => handleChange('lineNumber', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routeName">Strecke</Label>
              <Input
                id="routeName"
                value={line.routeName || ''}
                onChange={e => handleChange('routeName', e.target.value)}
                required
                placeholder="z.B. Hauptbahnhof - Flughafen"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distanceKm">Entfernung (km)</Label>
                <Input
                  id="distanceKm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={line.distanceKm || ''}
                  onChange={e =>
                    handleChange('distanceKm', Number(e.target.value))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Dauer (Minuten)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  min="1"
                  value={line.durationMinutes || ''}
                  onChange={e =>
                    handleChange('durationMinutes', Number(e.target.value))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Kompatible Busgrößen</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="size-small"
                    checked={(line.compatibleBusSizes || []).includes(
                      BusSize.SMALL
                    )}
                    onCheckedChange={checked =>
                      handleBusSizeChange(BusSize.SMALL, checked as boolean)
                    }
                  />
                  <Label htmlFor="size-small">Klein</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="size-medium"
                    checked={(line.compatibleBusSizes || []).includes(
                      BusSize.MEDIUM
                    )}
                    onCheckedChange={checked =>
                      handleBusSizeChange(BusSize.MEDIUM, checked as boolean)
                    }
                  />
                  <Label htmlFor="size-medium">Mittel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="size-large"
                    checked={(line.compatibleBusSizes || []).includes(
                      BusSize.LARGE
                    )}
                    onCheckedChange={checked =>
                      handleBusSizeChange(BusSize.LARGE, checked as boolean)
                    }
                  />
                  <Label htmlFor="size-large">Groß</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="size-articulated"
                    checked={(line.compatibleBusSizes || []).includes(
                      BusSize.ARTICULATED
                    )}
                    onCheckedChange={checked =>
                      handleBusSizeChange(
                        BusSize.ARTICULATED,
                        checked as boolean
                      )
                    }
                  />
                  <Label htmlFor="size-articulated">Gelenkbus</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Fahrplan (Wochentage)</Label>
              <div className="space-y-4">
                {WEEKDAYS.map(weekday => (
                  <div key={weekday.value} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={weekday.value}
                        checked={selectedDays.includes(weekday.value)}
                        onCheckedChange={checked =>
                          handleDayChange(weekday.value, checked as boolean)
                        }
                      />
                      <Label htmlFor={weekday.value} className="font-medium">
                        {weekday.label}
                      </Label>
                    </div>

                    {selectedDays.includes(weekday.value) && (
                      <div className="grid grid-cols-2 gap-4 ml-6 mt-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`${weekday.value}-start`}
                            className="text-sm"
                          >
                            Start
                          </Label>
                          <Input
                            id={`${weekday.value}-start`}
                            type="time"
                            value={
                              (
                                (line.weeklySchedule || {})[
                                  weekday.value as keyof WeeklySchedule
                                ] as TimeSchedule
                              )?.start || ''
                            }
                            onChange={e =>
                              handleTimeChange(
                                weekday.value,
                                'start',
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`${weekday.value}-end`}
                            className="text-sm"
                          >
                            Ende
                          </Label>
                          <Input
                            id={`${weekday.value}-end`}
                            type="time"
                            value={
                              (
                                (line.weeklySchedule || {})[
                                  weekday.value as keyof WeeklySchedule
                                ] as TimeSchedule
                              )?.end || ''
                            }
                            onChange={e =>
                              handleTimeChange(
                                weekday.value,
                                'end',
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={line.isActive}
                onCheckedChange={checked => handleChange('isActive', checked)}
              />
              <Label htmlFor="isActive">Aktiv</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/lines')}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}