# Bus Planner

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.2.19. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

It uses React 19, Tailwind v4, RadixUi and ShadCN components

# Requirements Specification

## Executive Summary

This document specifies a resource planning system for urban bus operations. The system enables efficient assignment of buses and drivers to scheduled routes while providing visibility into operational constraints and preferences. The primary goal is to replace manual Excel-based planning with a digital solution that helps identify conflicts while maintaining full flexibility for dispatchers.

## System Overview

### Core Purpose

Create a planning tool that assigns available buses and drivers to scheduled bus lines across different shifts, providing clear visibility of conflicts and constraint violations while allowing dispatchers full control over assignments.

### Key Principles

- **Flexibility Over Enforcement**: Show constraint violations but allow dispatchers to override
- **Minimal State Management**: Only persist actual assignments, not empty slots
- **Conflict Visibility**: Clear indication of double-bookings and other issues
- **Simplicity**: Focus on essential planning functions without overengineering

## Domain Model

### Bus Entity

Each bus represents a physical vehicle with the following characteristics:

- Unique license plate identifier
- Size classification (small, medium, large, articulated)
- Propulsion type (diesel or electric)
- For electric buses: maximum range capacity
- Specific dates when unavailable (maintenance, repairs, etc.)

### Driver Entity

Each driver represents an employee with:

- Full name
- Weekly working hours commitment
- Available working days (empty means all days available)
- Shift preferences (early, late, night, or no preference)
- Shifts to avoid
- Specific dates when unavailable (vacation, sick leave, etc.)

### Line Entity

Each line represents a bus route with:

- Line number (e.g., "52", "X30")
- Route name describing start and end points
- Distance in kilometers
- Journey duration in minutes
- Compatible bus sizes
- Operating schedule per weekday (start and end times)
- Active status

### Shift Structure

The operational day is divided into three shifts:

- Early shift: 5:00 - 13:00
- Late shift: 13:00 - 21:00
- Night shift: 21:00 - 5:00

### Assignment Model

An assignment links:

- A specific date
- A shift type
- A line
- An assigned bus (required)
- An assigned driver (required)

Assignments are stored individually as they are created. No pre-generation of empty slots occurs.

## Functional Requirements

### Planning Workflow

1. **Required Shifts Calculation**
   - System calculates which shifts need coverage based on line schedules
   - Shows requirements without creating database entries
   - Updates dynamically as line schedules change

2. **Resource Assignment**
   - Planners select line, shift, and date
   - Dropdown selection of available buses
   - Dropdown selection of available drivers
   - Clear indication of resource availability

3. **Constraint Visibility**
   - Visual warnings for:
     - Double-booked resources
     - Bus size mismatches
     - Insufficient electric bus range
     - Driver exceeding weekly hours
     - Assignment against driver preferences
     - Resources assigned on their unavailable dates
   - All warnings are informational only - assignments proceed regardless

4. **Status Overview**
   - Coverage percentage for each day/week
   - List of uncovered shifts
   - Conflict summary
   - Resource utilization view

### User Interface Requirements

#### Navigation Structure

- Three main sections: Master Data, Planning, Reports
- Simple tab-based organization
- Consistent navigation from all screens

#### Master Data Management

**Bus Management**

- Table showing all buses with current status
- Form for adding new buses
- Editing of existing bus details
- Calendar widget for marking unavailable dates
- Visual indicator for electric vs diesel buses

**Driver Management**

- Table showing all drivers
- Form for adding new drivers
- Configuration of availability and preferences
- Calendar widget for marking unavailable dates (vacation, sick days)
- Weekly hours setting

**Line Management**

- Table showing all lines
- Form for adding new lines
- Schedule configuration per weekday
- Compatible bus size selection

#### Planning Interface

**Assignment Creation**

- Selection workflow: Date → Line → Shift → Bus → Driver
- Dropdown menus showing:
  - Resource name/identifier
  - Availability status
  - Warning indicators if constraints violated
- Summary of selected assignment before saving
- Clear feedback on successful creation

**Day View**

- List of all assignments for selected day
- Grouped by shift type
- Shows bus, driver, and line for each assignment
- Warning badges for conflicts
- Edit and delete options for each assignment

**Week View**

- Seven-day grid showing coverage summary
- Each cell shows:
  - Number of assignments made
  - Number of shifts required
  - Conflict count if any
- Click-through to day detail

**Month View**

- Calendar displaying planning status
- Color coding for completion levels
- Quick navigation to specific days

#### Visual Design Elements

- Clean interface with clear information hierarchy
- Consistent color usage:
  - Green: Available/Complete
  - Orange: Warning/Preference violation
  - Red: Conflict/Double-booking
  - Gray: Unavailable
- German language throughout
- Warning icons with explanatory tooltips

### Data Management

#### Persistence

- File-based storage using JSON format
- Separate files for buses, drivers, and lines
- Individual assignment files organized by date
- Manual save actions required
- Simple backup through file copying

#### Data Integrity

- Unique identifiers for all entities
- System maintains referential consistency
- Validation provides warnings but doesn't block actions
- Graceful handling of missing references

## System Constraints and Warnings

### Warnings Displayed (Not Enforced)

1. **Double Booking**
   - Same bus assigned to multiple lines in same shift
   - Same driver assigned to multiple lines in same shift

2. **Compatibility Issues**
   - Bus size not matching line requirements
   - Electric bus with insufficient range for line distance

3. **Availability Conflicts**
   - Bus assigned on marked unavailable date
   - Driver assigned on marked unavailable date

4. **Preference Violations**
   - Driver assigned to non-preferred shift
   - Driver assigned to avoided shift

5. **Working Time**
   - Driver exceeding weekly hours limit

### Required Information

All assignments must have:

- Valid date
- Valid line reference
- Valid shift type
- Assigned bus
- Assigned driver

## System Boundaries

### Included

- Basic resource assignment
- Conflict identification
- Coverage tracking
- Simple availability management

### Excluded

- Automatic shift generation
- Route optimization
- Cost calculations
- Detailed scheduling
- Historical analysis
- Automatic conflict resolution
- Complex rules engine

## Success Criteria

The system meets its objectives when:

1. Dispatchers can quickly see what shifts need coverage
2. All potential conflicts are clearly visible
3. Assignments can be made regardless of warnings
4. The current planning state is always clear
5. Common planning tasks require minimal clicks
6. System remains responsive and simple to understand
