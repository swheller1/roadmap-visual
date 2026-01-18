# Roadmap Visual User Manual

**Version 1.0.0** | January 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Data Configuration](#data-configuration)
4. [Visual Features](#visual-features)
5. [Format Settings](#format-settings)
6. [Interactivity](#interactivity)
7. [Azure DevOps Integration](#azure-devops-integration)
8. [Tips and Best Practices](#tips-and-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Introduction

The Roadmap Visual is a Power BI custom visual designed for displaying project roadmaps with Epics, Features, and Milestones. It provides a Gantt-style timeline view with hierarchical work item organization, swimlane grouping, and Azure DevOps Analytics integration.

### Key Features

- **Timeline Visualization**: Gantt-style bars showing work item durations
- **Hierarchical Display**: Parent-child relationships with collapsible Epic sections
- **Swimlane Grouping**: Organize by Area Path, Iteration, Assigned To, State, Priority, or Tags
- **Discrete Zoom Levels**: Day, week, month, and year views for optimal navigation
- **Today Line**: Visual indicator of current date
- **Milestone Markers**: Diamond indicators for key milestone dates
- **Customizable Colors**: Configure colors for Epics, Features, and Milestones
- **Selection Support**: Click to select items; integrates with other Power BI visuals
- **Context Menu**: Right-click for Power BI context menu options

---

## Getting Started

### Installation

1. Download or build the `.pbiviz` file
2. In Power BI Desktop, click the ellipsis (...) in the Visualizations pane
3. Select **Import a visual from a file**
4. Navigate to and select the `.pbiviz` file
5. The Roadmap Visual icon appears in your Visualizations pane

### Quick Setup

1. Add the Roadmap Visual to your report canvas
2. Connect to your data source (Azure DevOps OData or other)
3. Drag fields to the required data roles:
   - **Work Item ID** (required)
   - **Title** (required)
   - **Work Item Type** (required)
4. Add recommended fields for full functionality:
   - **Start Date** and **Target Date** for timeline bars
   - **Parent ID** for hierarchy
   - **Area Path** for swimlane grouping

---

## Data Configuration

### Required Fields

| Data Role | Description | Notes |
|-----------|-------------|-------|
| **Work Item ID** | Unique identifier | Numeric ID for each item |
| **Title** | Display name | Shown in left panel and bar labels |
| **Work Item Type** | Epic, Feature, or Milestone | Controls display style |

### Optional Fields

| Data Role | Description | Use Case |
|-----------|-------------|----------|
| **Start Date** | Work start date | Required for timeline bars |
| **Target Date** | Work end/due date | Required for timeline bars and milestones |
| **Parent ID** | Parent work item ID | Links Features to Epics for hierarchy |
| **State** | Work item state | Swimlane grouping option |
| **Area Path** | Team/area classification | Swimlane grouping option |
| **Iteration Path** | Sprint/iteration | Swimlane grouping option |
| **Assigned To** | Owner/assignee | Swimlane grouping option |
| **Priority** | Priority level (1-4) | Swimlane grouping option |
| **Tags** | Comma-separated tags | Swimlane grouping option |

### Data Requirements

- **Epics**: Display as larger timeline bars; act as parent containers
- **Features**: Display as medium bars; can be children of Epics
- **Milestones**: Display as diamond markers; require only Target Date

---

## Visual Features

### Timeline View

The visual displays work items on a horizontal timeline:

- **Epics**: Large colored bars spanning start to target date
- **Features**: Medium bars, grouped under parent Epics
- **Milestones**: Diamond markers at target date
- **Today Line**: Red vertical line indicating current date

### Discrete Zoom Levels

The timeline uses discrete zoom levels for optimal navigation:

| Level | View | Day Width | Best For |
|-------|------|-----------|----------|
| 0.5x | Year overview | 5px | Annual planning |
| 1x | Month view | 16px | Quarterly roadmaps |
| 2x | Week view | 28px | Sprint planning |
| 3x+ | Day view | 40px | Detailed scheduling |

### Hierarchical Organization

When **Swimlanes** are disabled:
- Epics display at the top level
- Features and Milestones group under their parent Epic
- Click the chevron (▶/▼) to collapse/expand Epic sections

### Swimlane Grouping

When **Swimlanes** are enabled:
- Work items group by the selected field
- Each swimlane header shows the group name and item count
- Click swimlane headers to collapse/expand

---

## Format Settings

Access format settings by selecting the visual and opening the Format pane.

### General

| Setting | Description | Default |
|---------|-------------|---------|
| **Title** | Main heading displayed at top | "Roadmap" |
| **Subtitle** | Secondary text below title | "Work Items" |

### Swimlanes

| Setting | Description | Default |
|---------|-------------|---------|
| **Show Swimlanes** | Enable swimlane grouping | Off |
| **Group By** | Field to group by | None |

**Group By Options:**
- None (hierarchical Epic-based layout)
- Area Path
- Iteration Path
- Assigned To
- State
- Priority
- Tags

### Colors

| Setting | Description | Default |
|---------|-------------|---------|
| **Epic Color** | Color for Epic bars | Indigo (#4F46E5) |
| **Milestone Color** | Color for Milestone diamonds | Red (#DC2626) |
| **Feature Color** | Color for Feature bars | Cyan (#0891B2) |

### Dependencies

| Setting | Description | Default |
|---------|-------------|---------|
| **Show Dependencies** | Display dependency lines | On |

---

## Interactivity

### Selection

- **Single Click**: Select a work item (highlights across visuals)
- **Ctrl+Click**: Multi-select work items
- **Click Background**: Clear selection

### Context Menu

- **Right-Click** any work item or the background for Power BI context menu
- Options include: Show data point, Remove, Spotlight, etc.

### Collapse/Expand

- **Click Epic row**: Collapse or expand child items
- **Click Swimlane header**: Collapse or expand swimlane contents

### Scrolling

- **Vertical Scroll**: Navigate through work items (left and timeline panels sync)
- **Horizontal Scroll**: Navigate through timeline (in timeline panel)

---

## Azure DevOps Integration

### Connecting to Azure DevOps Analytics

1. In Power BI Desktop, click **Get Data** > **OData Feed**

2. Enter the OData URL for your organization:
   ```
   https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/WorkItems
   ```

3. Add query parameters for filtering and field selection (see examples below)

4. Authenticate with **Organizational Account** using Azure DevOps credentials

### OData Query Examples

**Minimal Query (Required Fields):**
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

**Filtered by Date Range:**
```
https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/WorkItems?
  $select=WorkItemId,Title,WorkItemType,State,StartDate,TargetDate,ParentWorkItemId
  &$filter=WorkItemType in ('Epic','Feature','Milestone')
    and TargetDate ge 2024-01-01
    and TargetDate le 2024-12-31
  &$expand=Area($select=AreaPath)
```

### Field Mapping Reference

| Visual Data Role | OData Field | Expand Required |
|------------------|-------------|-----------------|
| Work Item ID | `WorkItemId` | No |
| Title | `Title` | No |
| Work Item Type | `WorkItemType` | No |
| State | `State` | No |
| Start Date | `StartDate` | No |
| Target Date | `TargetDate` | No |
| Parent ID | `ParentWorkItemId` | No |
| Area Path | `AreaPath` | Yes: `$expand=Area($select=AreaPath)` |
| Iteration Path | `IterationPath` | Yes: `$expand=Iteration($select=IterationPath)` |
| Assigned To | `UserName` | Yes: `$expand=AssignedTo($select=UserName)` |
| Priority | `Priority` | No |
| Tags | `Tags` | No |

### Power Query Transformations

After connecting, you may need to transform data in Power Query:

1. **Expand nested columns**: Area, Iteration, AssignedTo
2. **Rename columns**: Match visual data role names
3. **Set data types**: Ensure dates are Date type, IDs are numeric

---

## Tips and Best Practices

### Data Preparation

- **Always include Work Item Type filter** to limit to Epic/Feature/Milestone
- **Set appropriate date ranges** to avoid loading entire project history
- **Ensure Parent IDs reference valid Epic Work Item IDs** for hierarchy

### Visual Layout

- **Use swimlanes for large datasets** to improve organization
- **Group by Area Path** for team-based views
- **Group by Iteration Path** for sprint-based views
- **Collapse completed Epics** to focus on active work

### Performance

- **Limit data to 10,000 items** (visual's data reduction limit)
- **Use OData $filter** to pre-filter at source
- **Avoid loading unnecessary fields** if not using swimlanes

### Color Coding

- **Use consistent colors** across reports for work item types
- **Consider colorblind-friendly palettes** for accessibility
- **Match organizational standards** if applicable

---

## Troubleshooting

### Visual Not Loading

- Verify all required fields are mapped (Work Item ID, Title, Type)
- Check browser console (F12) for error messages
- Ensure data has valid Epic/Feature/Milestone type values

### No Timeline Bars Displayed

- Verify Start Date and Target Date fields are mapped
- Check that date fields are Date type, not Text
- Ensure dates are not null for items requiring bars

### Hierarchy Not Working

- Verify Parent ID field is mapped
- Parent ID values must match Epic Work Item IDs exactly
- Features should reference their parent Epic's Work Item ID

### Swimlanes Not Grouping

- Enable "Show Swimlanes" in Format pane
- Select a "Group By" option other than "None"
- Ensure the grouping field has data

### OData Connection Issues

- Verify organization and project names in URL
- Check Azure DevOps permissions (Analytics read access required)
- Ensure correct authentication method (Organizational Account)

### Certificate Errors (Development)

Run the following command and restart Power BI Desktop:
```bash
pbiviz --install-cert
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 2026 | Initial release with core roadmap functionality |

---

## Support

For issues, feature requests, or questions:

- **GitHub**: [https://github.com/swheller1/roadmap-visual](https://github.com/swheller1/roadmap-visual)
- Open an issue with detailed reproduction steps
