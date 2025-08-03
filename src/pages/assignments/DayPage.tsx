import { useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function DayPage() {
    const { date } = useParams<{ date: string }>();
    const [searchParams] = useSearchParams();
    const lineId = searchParams.get('lineId');

    // Format date for display
    const formattedDate = date ? format(new Date(date), 'dd.MM.yyyy', { locale: de }) : '';

    return (
        <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">
                    Zuweisung für den {formattedDate}
                    {lineId ? ` (Linie ${lineId})` : ''}
                </h1>
            </div>
            <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
        </div>
    );
}
