import { serve } from 'bun';
import index from './index.html';

import { Bus, BusSize, PropulsionType } from './models/entities/Bus.js';
import { Driver, ShiftType } from './models/entities/Driver.js';
import { Line } from './models/entities/Line.js';
import { Assignment } from './models/entities/Assignment.js';

import { PlanningService } from './services/PlanningService.js';
import { AppState } from '@/state/AppState.ts';

const planningService = new PlanningService('./data/bus-planner.json');
planningService.initialize().catch(error => {
  console.error('Failed to initialize planning service:', error);
});

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    '/*': index,

    // API Routes
    '/api/buses': {
      async GET() {
        return Response.json(planningService.state.getAllBuses());
      },
      async POST(req) {
        const data = await req.json();
        const bus = new Bus(
          data.licensePlate,
          data.size as BusSize,
          data.propulsionType as PropulsionType,
          data.maxRangeKm
        );
        const result = await planningService.state.createBus(bus);
        return Response.json(result);
      },
    },

    '/api/buses/:id': {
      async GET(req) {
        const bus = planningService.state.getBus(req.params.id);
        if (!bus) return new Response('Bus not found', { status: 404 });
        return Response.json(bus);
      },
      async PUT(req) {
        const data = await req.json();
        const updated = await planningService.state.updateBus(
          req.params.id,
          data
        );
        if (!updated) return new Response('Bus not found', { status: 404 });
        return Response.json(updated);
      },
      async DELETE(req) {
        const deleted = await planningService.state.deleteBus(req.params.id);
        if (!deleted) return new Response('Bus not found', { status: 404 });
        return new Response('Bus deleted', { status: 200 });
      },
    },

    '/api/drivers': {
      async GET() {
        return Response.json(planningService.state.getAllDrivers());
      },
      async POST(req) {
        const data = await req.json();
        const driver = new Driver(
          data.fullName,
          data.weeklyHours,
          data.preferredShifts,
          data.shiftsToAvoid,
          data.availableDays
        );
        const result = await planningService.state.createDriver(driver);
        return Response.json(result);
      },
    },

    '/api/drivers/:id': {
      async GET(req) {
        const driver = planningService.state.getDriver(req.params.id);
        if (!driver) return new Response('Driver not found', { status: 404 });
        return Response.json(driver);
      },
      async PUT(req) {
        const data = await req.json();
        const updated = await planningService.state.updateDriver(
          req.params.id,
          data
        );
        if (!updated) return new Response('Driver not found', { status: 404 });
        return Response.json(updated);
      },
      async DELETE(req) {
        const deleted = await planningService.state.deleteDriver(req.params.id);
        if (!deleted) return new Response('Driver not found', { status: 404 });
        return new Response('Driver deleted', { status: 200 });
      },
    },

    '/api/lines': {
      async GET() {
        return Response.json(planningService.state.getAllLines());
      },
      async POST(req) {
        const data = await req.json();
        const line = new Line(
          data.lineNumber,
          data.routeName,
          data.distanceKm,
          data.durationMinutes,
          data.compatibleBusSizes,
          data.weeklySchedule,
          data.isActive
        );
        const result = await planningService.state.createLine(line);
        return Response.json(result);
      },
    },

    '/api/lines/:id': {
      async GET(req) {
        const line = planningService.state.getLine(req.params.id);
        if (!line) return new Response('Line not found', { status: 404 });
        return Response.json(line);
      },
      async PUT(req) {
        const data = await req.json();
        const updated = await planningService.state.updateLine(
          req.params.id,
          data
        );
        if (!updated) return new Response('Line not found', { status: 404 });
        return Response.json(updated);
      },
      async DELETE(req) {
        const deleted = await planningService.state.deleteLine(req.params.id);
        if (!deleted) return new Response('Line not found', { status: 404 });
        return new Response('Line deleted', { status: 200 });
      },
    },

    '/api/assignments': {
      async GET() {
        return Response.json(planningService.state.getAllAssignments());
      },
      async POST(req) {
        const data = await req.json();
        const result = await planningService.createAssignment(
          new Date(data.date),
          data.shift as ShiftType,
          data.lineId,
          data.busId,
          data.driverId
        );
        return Response.json(result);
      },
    },

    '/api/assignments/:id': {
      async GET(req) {
        const assignment = planningService.state.getAssignment(req.params.id);
        if (!assignment)
          return new Response('Assignment not found', { status: 404 });
        return Response.json(assignment);
      },
      async DELETE(req) {
        const deleted = await planningService.state.deleteAssignment(
          req.params.id
        );
        if (!deleted)
          return new Response('Assignment not found', { status: 404 });
        return new Response('Assignment deleted', { status: 200 });
      },
    },

    '/api/assignments/date/:date': async req => {
      const date = new Date(req.params.date);
      return Response.json(planningService.state.getAssignmentsByDate(date));
    },

    // Stats endpoints
    '/api/stats': async () => {
      return Response.json(planningService.state.getStats());
    },

    '/api/stats/planning-status': async () => {
      return Response.json(planningService.state.getPlanningStatus());
    },

    // Settings endpoints
    '/api/settings/load-sample-data': async () => {
      try {
        const success = await planningService.loadSampleData();
        return Response.json({
          success,
          message: success
            ? 'Sample data loaded successfully'
            : 'Failed to load sample data',
        });
      } catch (error) {
        console.error('Error loading sample data:', error);
        return Response.json(
          {
            success: false,
            message: `Error loading sample data: ${(error as Error).message}`,
          },
          { status: 500 }
        );
      }
    },

    '/api/settings/reset-data': async () => {
      try {
        const success = await planningService.resetData();
        return Response.json({
          success,
          message: success ? 'Data reset successfully' : 'Failed to reset data',
        });
      } catch (error) {
        console.error('Error resetting data:', error);
        return Response.json(
          {
            success: false,
            message: `Error resetting data: ${(error as Error).message}`,
          },
          { status: 500 }
        );
      }
    },

    // Backup endpoints
    '/api/settings/backup': async () => {
      const backupFile = await planningService.backup();
      return Response.json({ backupFile });
    },

    '/api/settings/backups': async () => {
      const backups = await planningService.getBackups();
      return Response.json(backups);
    },

    '/api/settings/current-backup': async () => {
      const currentBackup = await planningService.getCurrentBackupInfo();
      return Response.json(currentBackup);
    },

    '/api/settings/backups/restore/:filename': async req => {
      try {
        const success = await planningService.restoreBackup(
          req.params.filename
        );
        return Response.json({
          success,
          message: success
            ? 'Backup restored successfully'
            : 'Failed to restore backup',
          filename: req.params.filename,
        });
      } catch (error) {
        console.error('Error restoring backup:', error);
        return Response.json(
          {
            success: false,
            message: `Error restoring backup: ${(error as Error).message}`,
            filename: req.params.filename,
          },
          { status: 500 }
        );
      }
    },

    // Keeping the old backup endpoint for backward compatibility
    '/api/backup': async () => {
      const backupFile = await planningService.backup();
      return Response.json({ backupFile });
    },
    '/api/backups': async () => {
      return Response.redirect('/api/settings/backups');
    },
    '/api/backups/restore/:filename': async req => {
      return Response.redirect(
        `/api/settings/backups/restore/${req.params.filename}`
      );
    },
  },

  development: process.env.NODE_ENV !== 'production' && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Bus Planner Server running at ${server.url}`);
