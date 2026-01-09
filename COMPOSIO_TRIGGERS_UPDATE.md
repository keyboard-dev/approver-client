# Composio Triggers API Update

## Overview
Updated the frontend to support the new enriched trigger endpoint format from the backend API.

## Changes Made

### 1. Type Definitions (`src/renderer/services/composio-service.ts`)

**Updated `ComposioAvailableTrigger` interface** to include:
- `slug`: Trigger identifier (e.g., `GOOGLECALENDAR_EVENT_CREATED_TRIGGER`)
- `name`: Human-readable name
- `description`: Trigger description
- `instructions`: Setup instructions
- `toolkit`: Object containing logo, slug, and name
- `payload`: Schema for trigger payload data
- `config`: Schema for trigger configuration options
- `version`: Trigger version string

**Updated `ListAvailableTriggersResponse`**:
- Changed from `data?: { items: ComposioAvailableTrigger[] }` 
- To `data?: ComposioAvailableTrigger[]`
- The API now returns triggers directly in the data array

### 2. Hook Updates (`src/renderer/hooks/useComposio.ts`)

**Updated `fetchAvailableTriggers`**:
- Changed from `response.data?.items || []`
- To `response.data || []`
- Matches new API response structure

### 3. UI Updates (`src/renderer/components/screens/settings/panels/ComposioTriggersPanel.tsx`)

**Enhanced trigger display** to show:
- Toolkit logo (if available)
- Trigger name (as title)
- Description (2-line clamp)
- Instructions (italic, 2-line clamp)
- Slug (in monospace font)
- Version number
- Number of configuration options

**Improved layout**:
- Better spacing between trigger cards
- Logo displayed alongside trigger info
- More informative metadata badges
- Cleaner visual hierarchy

## API Endpoint

The endpoint returns data in this format:

```json
{
  "success": true,
  "data": [
    {
      "slug": "GOOGLECALENDAR_EVENT_CREATED_TRIGGER",
      "name": "Event Created",
      "description": "Polling trigger that fires when a new calendar event is created...",
      "instructions": "This trigger monitors a Google Calendar...",
      "toolkit": {
        "logo": "https://logos.composio.dev/api/googlecalendar",
        "slug": "googlecalendar",
        "name": "googlecalendar"
      },
      "payload": {
        "description": "Payload structure for newly created Google Calendar event",
        "properties": { ... },
        "required": ["event_id", "calendar_id"],
        "title": "GoogleCalendarEventCreatedPayload",
        "type": "object"
      },
      "config": {
        "description": "Configuration for Google Calendar 'Event Created' polling trigger",
        "properties": { ... },
        "title": "GoogleCalendarEventCreatedConfig",
        "type": "object"
      },
      "version": "20260107_00"
    }
  ]
}
```

## Testing

To test the changes:
1. Navigate to Settings > Composio Triggers
2. Click on any connected app (or connect a new one)
3. View the available triggers list
4. Triggers should display with:
   - App logo
   - Trigger name and description
   - Instructions
   - Metadata (slug, version, config options count)

## Notes

- The main.ts IPC handler (`list-composio-available-triggers`) did not require changes as it passes through the API response directly
- No linter errors were introduced
- The preload.ts types use generic `unknown` so no changes needed there
