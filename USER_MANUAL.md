# ROADMAP VISUAL for Power BI

## USER MANUAL

| Document Version | Date | Audience |
|------------------|------|----------|
| 1.0.0.0 | January 2026 | Australian Public Sector Power BI Creators |

**AI Disclosure:** Artificial Intelligence was used during the creation of this documentation and the associated codebase.

### Licence

This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.

https://creativecommons.org/licenses/by-nc-sa/4.0/

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Security Posture](#3-security-posture)
4. [Compliance Summary](#4-compliance-summary)
5. [User Guide](#5-user-guide)
6. [Azure DevOps OData Integration](#6-azure-devops-odata-integration)
7. [Support and Maintenance](#7-support-and-maintenance)
8. [Security Attestation](#8-security-attestation)

---

## 1. Executive Summary

The Roadmap Visual is a custom Power BI visual designed to display project timelines, milestones, and work items in an interactive roadmap format. This visual is built specifically for use within the Power BI ecosystem and adheres to Microsoft certification requirements.

### Security Summary

- No data transmission to external servers
- No data storage (localStorage, cookies, IndexedDB)
- Executes entirely within Power BI sandbox
- Microsoft certification compliant

---

## 2. Architecture Overview

This section provides technical details about the visual architecture, data flow, and security boundaries. Understanding this architecture is essential for IT security assessments and governance reviews.

### 2.1 System Architecture

The Roadmap Visual operates as a self-contained component within the Power BI rendering engine. It follows a strict input-process-output model with no external dependencies or network calls.

#### Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           POWER BI SERVICE                  │
│  ┌─────────────────────────────────────┐   │
│  │       VISUAL SANDBOX (Isolated)     │   │
│  │  ┌─────────────────────────────┐   │   │
│  │  │    ROADMAP VISUAL           │   │   │
│  │  │  ┌───────┐    ┌──────────┐  │   │   │
│  │  │  │ D3.js │ →  │ SVG/DOM  │  │   │   │
│  │  │  └───────┘    └──────────┘  │   │   │
│  │  └─────────────────────────────┘   │   │
│  │         ↑ Data via DataView        │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2.2 Component Stack

The visual is built using the following technology stack, all of which are approved components within the Power BI Visuals SDK:

| Component | Version | Purpose |
|-----------|---------|---------|
| Power BI Visuals API | 5.8.0 | Core visual framework |
| TypeScript | 5.x | Type-safe development |
| D3.js | 7.8.5 | Data visualisation library |

### 2.3 Data Flow

Data flows through the visual in a strictly controlled, read-only manner:

1. Power BI loads data from configured data sources (e.g., Azure DevOps, Excel, SQL)
2. Data is passed to the visual via the DataView API (read-only)
3. Visual processes data in-memory to calculate positions and render timeline
4. D3.js renders SVG elements to the sandboxed DOM
5. User interactions (zoom, pan, expand) are handled locally within the sandbox

**Key Point:** No data leaves the Power BI boundary. The visual cannot and does not make any network requests, store data persistently, or communicate with external services.

---

## 3. Security Posture

This section details the security controls implemented in the Roadmap Visual and provides evidence of compliance with Australian Government security requirements.

### 3.1 Data Transmission

The visual does not transmit data to any external servers or services. This has been verified through code audit:

| Network API | Status |
|-------------|--------|
| fetch() / XMLHttpRequest | Not Used |
| WebSocket connections | Not Used |
| Beacon API | Not Used |
| External script loading | Not Used |
| Analytics/telemetry | Not Used |

### 3.2 Data Storage

The visual does not store any data persistently. All data exists only in memory during the active session:

| Storage API | Status |
|-------------|--------|
| localStorage | Not Used |
| sessionStorage | Not Used |
| IndexedDB | Not Used |
| Cookies | Not Used |
| File System Access | Not Used |

### 3.3 DOM Security

The visual follows secure DOM manipulation practices to prevent XSS and injection attacks:

| Security Control | Implementation |
|------------------|----------------|
| innerHTML usage | Prohibited - uses D3 .text() and .append() |
| Input sanitisation | sanitizeString() escapes all user data |
| eval() / Function() | Not used |
| Dynamic script injection | Not permitted |

---

## 4. Compliance Summary

The following table provides a comprehensive compliance assessment against Microsoft Power BI certification requirements and Australian Government security standards.

### 4.1 Microsoft Certification Compliance

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Power BI Visuals SDK | ✓ Compliant | powerbi-visuals-api v5.8.0 |
| TypeScript source code | ✓ Compliant | src/visual.ts |
| D3.js for rendering | ✓ Compliant | d3 v7.8.5 |
| Rendering Events API | ✓ Compliant | renderingStarted/Finished/Failed |
| Context Menu support | ✓ Compliant | selectionManager.showContextMenu() |
| Selection Manager | ✓ Compliant | Click and multi-select support |
| No external network calls | ✓ Compliant | No fetch/XHR/WebSocket |
| Safe DOM manipulation | ✓ Compliant | D3 .text() and .append() only |
| Input sanitisation | ✓ Compliant | sanitizeString() function |
| destroy() method | ✓ Compliant | Cleanup implemented |
| .gitignore file | ✓ Compliant | Included in package |
| tslint.json / eslint config | ✓ Compliant | Code quality rules applied |

### 4.2 Australian Government Security Compliance

| ISM Control Area | Status | Evidence |
|------------------|--------|----------|
| Data sovereignty - no offshore transmission | ✓ Compliant | No network calls |
| Data at rest protection | ✓ Compliant | No persistent storage |
| Data in transit protection | N/A | No data transmitted |
| Input validation | ✓ Compliant | All inputs sanitised |
| Code integrity | ✓ Compliant | Signed package, no eval() |
| Third-party component management | ✓ Compliant | Only approved SDK components |
| Logging and audit | ✓ Compliant | Power BI handles audit logging |

---

## 5. User Guide

This section provides instructions for using the Roadmap Visual within your Power BI reports.

### 5.1 Data Requirements

The visual requires specific data fields to render correctly. Map your data source columns to these fields in the Power BI field well:

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| WorkItemId | Number | Unique identifier for each item |
| Title | Text | Display name of the work item |
| StartDate | Date | When the item begins |
| TargetDate | Date | When the item is due |

#### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| WorkItemType | Text | Epic, Feature, Milestone, etc. |
| State | Text | Current status (New, Active, Closed) |
| ParentWorkItemId | Number | Links child items to parent Epics |
| AreaPath | Text | For swimlane grouping |
| IterationPath | Text | Sprint/iteration for grouping |
| AssignedTo | Text | Person responsible for the item |
| Priority | Number | 1-4 priority ranking |
| Tags | Text | Comma-separated tags for filtering |

### 5.2 Navigation Controls

| Action | How To |
|--------|--------|
| Pan timeline | Click and drag on the timeline area |
| Zoom in/out | Use time scale selector (Daily, Weekly, Monthly, Annual) |
| Expand/collapse Epic | Click on an Epic row to show/hide child items |
| Expand/collapse swimlane | Click on a swimlane header |
| Export PDF | Use the Export PDF option in the visual menu |

### 5.3 Zoom Levels

The visual uses discrete zoom levels for optimal navigation:

| Level | View | Day Width | Best For |
|-------|------|-----------|----------|
| 0.5x | Year overview | 5px | Annual planning |
| 1x | Month view | 16px | Quarterly roadmaps |
| 2x | Week view | 28px | Sprint planning |
| 3x+ | Day view | 40px | Detailed scheduling |

### 5.4 Settings Configuration

Access settings via the **Format** pane in Power BI when the visual is selected. Available options include:

- **Swimlane grouping:** Area Path, Iteration Path, Assigned To, State, Priority, Tags
- **Colour customisation:** Epic, Feature, and Milestone colours
- **Row density:** Compact, Normal, or Comfortable layouts
- **Dependencies:** Toggle dependency lines on/off
- **Milestone labels:** Position labels left, right, or hide them

---

## 6. Azure DevOps OData Integration

This section provides detailed guidance for connecting the Roadmap Visual to Azure DevOps Analytics via OData.

### 6.1 OData Field Reference

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

### 6.2 Sample OData Query URLs

**Basic Query (Required Fields Only):**
```
https://analytics.dev.azure.com/{org}/{project}/_odata/v4.0-preview/WorkItems?
  $select=WorkItemId,Title,WorkItemType,State,StartDate,TargetDate
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
  &$filter=WorkItemType in ('Epic','Feature','Milestone')
    and TargetDate ge 2024-01-01
    and TargetDate le 2024-12-31
  &$expand=Area($select=AreaPath)
```

### 6.3 Connection Steps

1. In Power BI Desktop, click **Get Data** → **OData Feed**
2. Enter the OData URL (see examples above), replacing `{org}` and `{project}` with your values
3. Select **Organizational Account** and authenticate with your Azure DevOps credentials
4. In Power Query Editor, transform data if needed:
   - Expand nested columns (Area, Iteration, AssignedTo)
   - Rename columns to match visual data roles
   - Set correct data types (dates, numbers)
5. Drag fields to the visual's data roles in the Fields pane

---

## 7. Support and Maintenance

### 7.1 Troubleshooting

| Issue | Resolution |
|-------|------------|
| Visual shows empty state | Ensure all required fields are mapped in the field well |
| Items not appearing on timeline | Check that StartDate and TargetDate are valid dates, not null |
| Parent-child relationships not showing | Verify ParentWorkItemId values match existing WorkItemIds |
| Performance issues with large datasets | Filter data to show fewer items, or increase row height |
| Swimlanes not grouping correctly | Ensure the grouping field has consistent values (no nulls) |
| OData connection issues | Verify organization and project names in URL; check Azure DevOps permissions |

### 7.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0.0 | January 2026 | Initial release with core roadmap functionality, Microsoft certification compliance, security hardening |

---

## 8. Security Attestation

This section provides a formal attestation for governance and security review purposes.

### Developer Attestation

I attest that the Roadmap Visual for Power BI:

1. Does not transmit data to any external servers or services
2. Does not store data persistently (no localStorage, cookies, IndexedDB)
3. Executes entirely within the Power BI visual sandbox boundary
4. Uses only approved Power BI Visuals SDK components
5. Implements input sanitisation to prevent XSS attacks
6. Does not include tracking, analytics, or telemetry capabilities

| | |
|---|---|
| **Signature:** | _______________________________ |
| **Name:** | _______________________________ |
| **Position:** | _______________________________ |
| **Date:** | _______________________________ |

---

*— End of Document —*
