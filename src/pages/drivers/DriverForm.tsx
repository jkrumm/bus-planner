import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Driver, ShiftType } from '@/models/entities/Driver';
import { useGetDriver, useCreateDriver, useUpdateDriver } from '@/api/queries/drivers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/date-picker';

const WEEKDAYS = [
  { value: 'monday', label: 'Montag' },
  { value: 'tuesday', label: 'Dienstag' },
  { value: 'wednesday', label: 'Mittwoch' },
  { value: 'thursday', label: 'Donnerstag' },
  { value: 'friday', label: 'Freitag' },
  { value: 'saturday', label: 'Samstag' },
  { value: 'sunday', label: 'Sonntag' },
];

const SHIFTS = [
  { value: ShiftType.MORNING, label: 'Frühschicht (5:00 - 13:00)' },
  { value: ShiftType.AFTERNOON, label: 'Spätschicht (13:00 - 21:00)' },
  { value: ShiftType.NIGHT, label: 'Nachtschicht (21:00 - 5:00)' },
];

export function DriverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Default driver state for new driver
  const defaultDriver: Partial<Driver> = {
    fullName: '',
    weeklyHours: 40,
    availableDays: [],
    preferredShifts: [],
    shiftsToAvoid: [],
    unavailableDates: [],
  };

  // State to track form changes
  const [formData, setFormData] = useState<Partial<Driver>>(defaultDriver);

  // Fetch driver data with centralized query hook
  const { 
    data: fetchedDriver,
    isLoading: isFetchLoading,
    error: fetchError
  } = useGetDriver(id);

  // Use centralized mutation hooks
  const createDriverMutation = useCreateDriver();
  const updateDriverMutation = useUpdateDriver(id);

  // Update form data when fetched data changes
  useEffect(() => {
    if (fetchedDriver) {
      setFormData({
        ...defaultDriver,  // Ensure all defaults are set first
        ...fetchedDriver,  // Then override with fetched data
        // Ensure arrays are never undefined
        availableDays: fetchedDriver.availableDays || [],
        preferredShifts: fetchedDriver.preferredShifts || [],
        shiftsToAvoid: fetchedDriver.shiftsToAvoid || [],
        unavailableDates: fetchedDriver.unavailableDates || [],
      });
    }
  }, [fetchedDriver]);

  // Combined loading state
  const isLoading = isFetchLoading || createDriverMutation.isPending || updateDriverMutation.isPending;

  // Combined error state
  const error = fetchError || createDriverMutation.error || updateDriverMutation.error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (id && id !== 'new') {
      updateDriverMutation.mutate(formData, {
        onSuccess: () => {
          navigate('/drivers');
        }
      });
    } else {
      createDriverMutation.mutate(formData, {
        onSuccess: () => {
          navigate('/drivers');
        }
      });
    }
  };

  const handleChange = (field: keyof Driver, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleWeekdayChange = (weekday: string, checked: boolean) => {
    const currentDays = formData.availableDays || [];
    if (checked) {
      handleChange('availableDays', [...currentDays, weekday]);
    } else {
      handleChange(
        'availableDays',
        currentDays.filter(day => day !== weekday)
      );
    }
  };

  const handleShiftPreferenceChange = (shift: ShiftType, checked: boolean) => {
    const currentShifts = formData.preferredShifts || [];
    if (checked) {
      handleChange('preferredShifts', [...currentShifts, shift]);
    } else {
      handleChange(
        'preferredShifts',
        currentShifts.filter(s => s !== shift)
      );
    }
  };

  const handleShiftAvoidChange = (shift: ShiftType, checked: boolean) => {
    const currentShifts = formData.shiftsToAvoid || [];
    if (checked) {
      handleChange('shiftsToAvoid', [...currentShifts, shift]);
    } else {
      handleChange(
        'shiftsToAvoid',
        currentShifts.filter(s => s !== shift)
      );
    }
  };

  if (isLoading && id && id !== 'new') {
    return (
      <div className="text-center py-10">Fahrer Daten werden geladen...</div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {id && id !== 'new' ? 'Fahrer bearbeiten' : 'Neuer Fahrer'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Display errors from React Query */}
          {error instanceof Error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Vollständiger Name</Label>
              <Input
                id="fullName"
                value={formData.fullName || ''}
                onChange={e => handleChange('fullName', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weeklyHours">Wochenstunden</Label>
              <Input
                id="weeklyHours"
                type="number"
                min="1"
                max="60"
                value={formData.weeklyHours || ''}
                onChange={e =>
                  handleChange('weeklyHours', Number(e.target.value))
                }
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Verfügbare Arbeitstage (leer = alle Tage)</Label>
              <div className="grid grid-cols-2 gap-3">
                {WEEKDAYS.map(weekday => (
                  <div
                    key={weekday.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={weekday.value}
                      checked={(formData.availableDays || []).includes(
                        weekday.value
                      )}
                      onCheckedChange={checked =>
                        handleWeekdayChange(weekday.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={weekday.value}>{weekday.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Bevorzugte Schichten</Label>
              <div className="space-y-2">
                {SHIFTS.map(shift => (
                  <div
                    key={shift.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`preferred-${shift.value}`}
                      checked={(formData.preferredShifts || []).includes(
                        shift.value
                      )}
                      onCheckedChange={checked =>
                        handleShiftPreferenceChange(
                          shift.value,
                          checked as boolean
                        )
                      }
                    />
                    <Label htmlFor={`preferred-${shift.value}`}>
                      {shift.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Schichten zu vermeiden</Label>
              <div className="space-y-2">
                {SHIFTS.map(shift => (
                  <div
                    key={shift.value}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`avoid-${shift.value}`}
                      checked={(formData.shiftsToAvoid || []).includes(
                        shift.value
                      )}
                      onCheckedChange={checked =>
                        handleShiftAvoidChange(shift.value, checked as boolean)
                      }
                    />
                    <Label htmlFor={`avoid-${shift.value}`}>
                      {shift.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nicht verfügbare Daten</Label>
              <DatePicker
                dates={
                  Array.isArray(formData.unavailableDates)
                    ? formData.unavailableDates
                    : []
                }
                onDatesChange={dates => {
                  // Ensure we're handling valid Date objects
                  const validDates = dates.filter(
                    d => d instanceof Date && !isNaN(d.getTime())
                  );

                  // Make sure we're creating new Date objects to avoid reference issues
                  const newDates = validDates.map(
                    date => new Date(date.getTime())
                  );
                  handleChange('unavailableDates', newDates);
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/drivers')}
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