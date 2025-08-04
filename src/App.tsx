import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppBreadcrumb } from '@/components/navigation/AppBreadcrumb';
import { BackupHistory } from '@/components/navigation/BackupHistory';

// Import page components
import { HomePage } from '@/pages/home/HomePage';
import { BusesPage } from '@/pages/buses/BusesPage';
import { BusForm } from '@/pages/buses/BusForm';
import { LinesPage } from '@/pages/lines/LinesPage';
import { LineForm } from '@/pages/lines/LineForm';
import { DriversPage } from '@/pages/drivers/DriversPage';
import { DataPage } from '@/pages/settings/DataPage';

import './index.css';
import { DriverForm } from '@/pages/drivers/DriverForm.tsx';
import { DayPage } from '@/pages/assignments/DayPage.tsx';

// Main App component with routing
export function App() {
  return (
    <>
      <Router>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b">
              <div className="flex items-center gap-2 px-3">
                <SidebarTrigger />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <AppBreadcrumb />
              </div>
              <BackupHistory />
            </header>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/busses" element={<BusesPage />} />
              <Route path="/busses/new" element={<BusForm />} />
              <Route path="/busses/edit/:id" element={<BusForm />} />
              <Route path="/lines" element={<LinesPage />} />
              <Route path="/lines/new" element={<LineForm />} />
              <Route path="/lines/edit/:id" element={<LineForm />} />
              <Route path="/drivers" element={<DriversPage />} />
              <Route path="/drivers/new" element={<DriverForm />} />
              <Route path="/drivers/edit/:id" element={<DriverForm />} />
              <Route path="/settings/data" element={<DataPage />} />
              <Route path="/assignments/day/:date" element={<DayPage />} />
            </Routes>
          </SidebarInset>
        </SidebarProvider>
      </Router>
    </>
  );
}
