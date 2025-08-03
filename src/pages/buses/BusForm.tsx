import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, BusSize, PropulsionType } from '@/models/entities/Bus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';
import { useGetBus, useCreateBus, useUpdateBus } from '@/api/queries/buses';

export function BusForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Default bus state for new bus
  const defaultBus: Partial<Bus> = {
    licensePlate: '',
    size: BusSize.MEDIUM,
    propulsionType: PropulsionType.DIESEL,
    maxRangeKm: undefined,
    unavailableDates: [],
  };

  // State to track form changes
  const [formData, setFormData] = useState<Partial<Bus>>(defaultBus);

  // Fetch bus data with centralized query hook
  const { 
    data: fetchedBus,
    isLoading: isFetchLoading,
    error: fetchError
  } = useGetBus(id);

  // Use centralized mutation hooks
  const createBusMutation = useCreateBus();
  const updateBusMutation = useUpdateBus(id);

  // Update form data when fetched data changes
  useEffect(() => {
    if (fetchedBus) {
      setFormData({
        ...defaultBus,  // Ensure all defaults are set first
        ...fetchedBus,  // Then override with fetched data
        // Ensure required fields are never undefined
        size: fetchedBus.size || BusSize.MEDIUM,
        propulsionType: fetchedBus.propulsionType || PropulsionType.DIESEL,
      });
    }
  }, [fetchedBus]);

  // Combined loading state
  const isLoading = isFetchLoading || createBusMutation.isPending || updateBusMutation.isPending;

  // Combined error state
  const error = fetchError || createBusMutation.error || updateBusMutation.error;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (id && id !== 'new') {
      updateBusMutation.mutate(formData, {
        onSuccess: () => {
          navigate('/busses');
        }
      });
    } else {
      createBusMutation.mutate(formData, {
        onSuccess: () => {
          navigate('/busses');
        }
      });
    }
  };

  const handleChange = (field: keyof Bus, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading && id && id !== 'new') {
    return <div className="text-center py-10">Bus Daten werden geladen...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {id && id !== 'new' ? 'Bus bearbeiten' : 'Neuer Bus'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Display errors from React Query */}
          {error instanceof Error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licensePlate">Kennzeichen</Label>
              <Input
                id="licensePlate"
                value={formData.licensePlate || ''}
                onChange={e => handleChange('licensePlate', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Größe</Label>
              <Select
                value={formData.size || ''}  // <- Handle undefined values
                onValueChange={value => handleChange('size', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Größe auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BusSize.SMALL}>Klein</SelectItem>
                  <SelectItem value={BusSize.MEDIUM}>Mittel</SelectItem>
                  <SelectItem value={BusSize.LARGE}>Groß</SelectItem>
                  <SelectItem value={BusSize.ARTICULATED}>Gelenkbus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="propulsionType">Antriebsart</Label>
              <Select
                value={formData.propulsionType || ''}  // <- Handle undefined values
                onValueChange={value => handleChange('propulsionType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Antriebsart auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PropulsionType.DIESEL}>Diesel</SelectItem>
                  <SelectItem value={PropulsionType.ELECTRIC}>
                    Elektrisch
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRangeKm">Maximale Reichweite (km)</Label>
              <Input
                id="maxRangeKm"
                type="number"
                value={formData.maxRangeKm || ''}
                onChange={e =>
                  handleChange(
                    'maxRangeKm',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Nicht verfügbare Datums</Label>
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
                  handleChange('unavailableDates', validDates);
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/busses')}
              >
                Abbrechen
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}