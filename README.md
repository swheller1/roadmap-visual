# Roadmap Visual for Power BI

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

A Power BI custom visual for displaying project roadmaps with Epics, Features, and Milestones. Designed for Australian public sector project portfolio management and digital transformation initiatives.

## Features

- **Timeline visualization** — Gantt-style bars for Epics, Features, and Milestones
- **Swimlane grouping** — Group by Area Path, Iteration, Assigned To, State, Priority, or Tags
- **Azure DevOps integration** — Connect directly to Azure DevOps Analytics
- **Hierarchical display** — Parent-child relationships with collapsible sections
- **Dependency lines** — Visual links between related work items
- **Customizable** — Colors, labels, and display options via Format pane

---

## License

This work is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to share and adapt this visual for non-commercial purposes with attribution.

---

## Certification Compliance

This visual is built to meet **Microsoft Power BI certification requirements**:

| Requirement | Status |
|-------------|--------|
| Power BI Visuals SDK (TypeScript/D3.js) | ✅ Compliant |
| Rendering Events API | ✅ Implemented |
| Context Menu support | ✅ Implemented |
| Safe DOM manipulation (no innerHTML) | ✅ Compliant |
| No external service calls | ✅ Compliant |
| Input sanitization | ✅ Implemented |
| Selection Manager integration | ✅ Implemented |
| destroy() method | ✅ Implemented |
| .gitignore file | ✅ Included |
| tslint.json | ✅ Included |

### Audit Command
Run security audit before packaging:
```bash
npm run audit
```

---

## Overview

This guide explains how to build and deploy the Roadmap Visual as a custom Power BI visual (.pbiviz file).

---

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (version 18 or later)
   - Download from: https://nodejs.org/

2. **Power BI Visual Tools (pbiviz)**
   ```bash
   npm install -g powerbi-visuals-tools
   ```

3. **Power BI Desktop** (latest version)
   - Download from: https://powerbi.microsoft.com/desktop/

4. **Certificate for development** (first time only)
   ```bash
   pbiviz --install-cert
   ```

---

## Quick Start (5 minutes)

### Step 1: Install Dependencies

```bash
cd powerbi-visual
npm install
```

### Step 2: Build the Visual Package

```bash
npm run package
```

This creates: `dist/roadmapVisual.pbiviz`

### Step 3: Import to Power BI Desktop

1. Open **Power BI Desktop**
2. Click the **ellipsis (...)** in the Visualizations pane
3. Select **Import a visual from a file**
4. Navigate to `dist/roadmapVisual.pbiviz`
5. Click **Open**

The Roadmap Visual icon appears in your Visualizations pane.

---

## Detailed Setup

### Project Structure

```
powerbi-visual/
├── assets/
│   └── icon.png          # Visual icon (20x20)
├── src/
│   └── visual.ts         # Main TypeScript source
├── style/
│   └── visual.less       # Styles
├── capabilities.json     # Data roles & mappings
├── package.json          # Dependencies
├── pbiviz.json          # Visual manifest
└── tsconfig.json        # TypeScript config
```

### Configuration Files

#### pbiviz.json
- `visual.guid`: Unique identifier (regenerate for your org)
- `visual.displayName`: Name shown in Power BI
- `apiVersion`: Power BI API version (5.8.0)

#### capabilities.json
- `dataRoles`: Defines data field slots
- `dataViewMappings`: How data maps to visual
- `objects`: Format pane settings

---

## Connecting to Data

### Required Fields

| Field | Data Role | Description | OData Field | Example |
|-------|-----------|-------------|-------------|---------|
| Work Item ID | `workItemId` | Unique identifier | `WorkItemId` | 1001 |
| Title | `title` | Item name | `Title` | "Platform Modernisation" |
| Work Item Type | `workItemType` | Epic/Feature/Milestone | `WorkItemType` | "Epic" |

### Recommended Fields

| Field | Data Role | Description | OData Field |
|-------|-----------|-------------|-------------|
| Start Date | `startDate` | When work begins | `StartDate` or `Microsoft.VSTS.Scheduling.StartDate` |
| Target Date | `targetDate` | Deadline/end date | `TargetDate` or `Microsoft.VSTS.Scheduling.TargetDate` |
| Parent ID | `parentId` | Links to parent Epic | `ParentWorkItemId` |
| State | `state` | New/Active/Closed | `State` |
| Area Path | `areaPath` | For swimlane grouping | `AreaPath` or `Area/AreaPath` |
| Iteration Path | `iterationPath` | Sprint/iteration | `IterationPath` or `Iteration/IterationPath` |
| Assigned To | `assignedTo` | Owner | `AssignedTo/UserName` |
| Priority | `priority` | Priority level (1-4) | `Priority` or `Microsoft.VSTS.Common.Priority` |
| Tags | `tags` | Comma-separated tags | `Tags` |

---

## Azure DevOps Analytics / OData Field Reference

### Complete Field List for OData Queries

When connecting to Azure DevOps Analytics, use these OData fields:

| Visual Field | OData Entity | OData Field Name | Notes |
|--------------|--------------|------------------|-------|
| Work Item ID | WorkItems | `WorkItemId` | Primary key |
| Title | WorkItems | `Title` | Display name |
| Work Item Type | WorkItems | `WorkItemType` | Filter: Epic, Feature, Milestone |
| State | WorkItems | `State` | New, Active, Resolved, Closed |
| Start Date | WorkItems | `StartDate` | May be null |
| Target Date | WorkItems | `TargetDate` | May be null |
| Parent ID | WorkItems | `ParentWorkItemId` | Links hierarchy |
| Area Path | Area | `AreaPath` | Use $expand=Area |
| Iteration Path | Iteration | `IterationPath` | Use $expand=Iteration |
| Assigned To | User | `UserName` | Use $expand=AssignedTo |
| Priority | WorkItems | `Priority` | Integer 1-4 |
| Tags | WorkItems | `Tags` | Comma-separated string |

### Sample OData Query URLs

**Basic Query (Required Fields Only):**
```
https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/WorkItems?
  $select=WorkItemId,Title,WorkItemType,State
  &$filter=WorkItemType in ('Epic','Feature','Milestone')
```

**Full Query (All Fields):**
```
https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/WorkItems?
  $select=WorkItemId,Title,WorkItemType,State,StartDate,TargetDate,ParentWorkItemId,Priority,Tags
  &$filter=WorkItemType in ('Epic','Feature','Milestone')
  &$expand=Area($select=AreaPath),Iteration($select=IterationPath),AssignedTo($select=UserName)
```

**With Date Filtering:**
```
https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/WorkItems?
  $select=WorkItemId,Title,WorkItemType,State,StartDate,TargetDate,ParentWorkItemId
  &$filter=WorkItemType in ('Epic','Feature','Milestone') and TargetDate ge 2024-01-01
  &$expand=Area($select=AreaPath)
```

### Azure DevOps Analytics Connection Steps

1. In Power BI Desktop, click **Get Data** → **OData Feed**

2. Enter the OData URL (see examples above), replacing `{org}` and `{project}` with your values

3. Select **Organizational Account** and authenticate with your Azure DevOps credentials

4. In Power Query Editor, transform data if needed:
   - Expand nested columns (Area, Iteration, AssignedTo)
   - Rename columns to match visual data roles
   - Set correct data types (dates, numbers)

5. Drag fields to the visual's data roles in the Fields pane

---

## Visual Settings

Access via **Format** pane when visual is selected:

### General
- **Title**: Main heading text
- **Subtitle**: Secondary text

### Swimlanes
- **Show Swimlanes**: Enable/disable grouping
- **Group By**: Area Path, Iteration, Assigned To, State, Priority, Tags

### Colors
- **Epic Color**: Default #4F46E5 (indigo)
- **Milestone Color**: Default #DC2626 (red)
- **Feature Color**: Default #0891B2 (cyan)

### Dependencies
- **Show Dependencies**: Display connecting lines

---

## Development Mode

For testing changes without rebuilding:

```bash
npm run start
```

This starts a local dev server. In Power BI:
1. Enable **Developer Visual** in Options → Preview features
2. Add the Developer Visual to your report
3. Changes auto-refresh

---

## Publishing to Organisation

### Option 1: Organisational Visuals

1. Build the package: `npm run package`
2. Go to **Power BI Admin Portal**
3. Navigate to **Organizational visuals**
4. Click **Add visual** → Upload `.pbiviz` file
5. Visual is now available to all users in your org

### Option 2: AppSource (Public)

For public distribution:
1. Ensure visual meets [certification requirements](https://docs.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified)
2. Submit via Partner Center
3. Microsoft reviews and publishes

---

## Troubleshooting

### "Certificate not trusted"
```bash
pbiviz --install-cert
```
Then restart Power BI Desktop.

### "Visual won't load"
- Check browser console (F12) for errors
- Ensure all data fields are mapped
- Verify date fields are Date type, not Text

### "No data displayed"
- Verify Work Item ID, Title, Type fields are mapped
- Check data has valid Epic/Feature/Milestone types
- Ensure dates are not null for items with bars

### Build errors
```bash
rm -rf node_modules
npm install
npm run package
```

---

## Security Notes

This visual:
- ✅ Does NOT transmit data externally
- ✅ Does NOT store data
- ✅ Runs entirely within Power BI sandbox
- ✅ Suitable for sensitive data

---

## Files Included

| File | Purpose |
|------|---------|
| `README.md` | Developer setup and reference |
| `USER_MANUAL.md` | End user guide |
| `package.json` | npm dependencies & scripts |
| `pbiviz.json` | Visual manifest |
| `capabilities.json` | Data roles & settings |
| `tsconfig.json` | TypeScript configuration |
| `src/visual.ts` | Main visual code |
| `style/visual.less` | Styling |
| `assets/icon.png` | Visual icon |

---

## Documentation

- **[User Manual](USER_MANUAL.md)** — Comprehensive guide for end users
- **[README](README.md)** — This file, for developers and setup

---

## Support

GitHub: [https://github.com/swheller1/roadmap-visual](https://github.com/swheller1/roadmap-visual)

For issues or feature requests, open a GitHub issue.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial release |
