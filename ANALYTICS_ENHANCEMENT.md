# Enhanced Analytics Implementation

## Overview
This update adds comprehensive analytics features to betaCLIProxyAPI, including user tracking, activity heatmaps, and detailed request history - similar to professional analytics dashboards like Claude.ai's usage page.

## Database Changes

### New Columns
The `request_logs` table now includes:
- `user` (TEXT): Records which user made the request
- `provider` (TEXT): Already existed, now properly indexed
- Additional indexes for better query performance

### Auto-Migration
The system automatically adds missing columns when starting up via `ensureRequestLogColumns()` function. If you have an existing database, it will be migrated automatically.

## New API Endpoints

### 1. Heatmap Data
```
GET /api/analytics/heatmap?days=365
```
Returns GitHub-style activity heatmap data with color levels (0-4).

Response:
```json
{
  "success": true,
  "entries": [
    {
      "date": "2024-12-31",
      "requests": 42,
      "level": 3
    }
  ]
}
```

### 2. User Usage Statistics
```
GET /api/analytics/users?days=7
```
Returns per-user usage breakdown.

Response:
```json
{
  "success": true,
  "entries": [
    {
      "user": "john@example.com",
      "requests": 150,
      "totalTokens": 500000,
      "models": 3,
      "lastActivity": "2024-12-31T10:30:00Z"
    }
  ]
}
```

### 3. Enhanced Recent Requests
The `/api/analytics/recent` endpoint now includes:
- `user`: Who made the request
- `accountId`: Which account was used
- `cost`: Estimated cost (if pricing data available)
- `type`: "Included", "Free", "Aborted, Not Charged", etc.

## New React Components

### 1. UsageHeatmap.tsx
- GitHub-style contribution graph showing daily activity
- Interactive tooltips on hover
- Color-coded activity levels (0-4)
- Covers last 365 days by default
- Responsive design with Framer Motion animations

### 2. DetailedRequestsTable.tsx
- Comprehensive request history table
- Columns: Date, Type, Model, Provider, User, Tokens, Cost, Latency
- Configurable row limit (25/50/100/200)
- Real-time refresh capability
- Color-coded request types (Success/Failed/Free/Aborted)
- Token formatting (K/M abbreviations)

### 3. UserUsageStats.tsx
- Bar chart visualization of user activity
- Sortable table with user statistics
- Summary cards showing:
  - Total active users
  - Combined token usage
  - Total request count
- Configurable time periods (24h/7d/30d/90d)

### 4. AnalyticsPage.tsx
- New dedicated analytics page at `/analytics`
- Combines all analytics components in one view:
  - Usage Overview (existing)
  - Activity Heatmap (new)
  - User Usage Statistics (new)
  - Detailed Request History (new)

## Navigation Updates

Added "Analytics" tab to main navigation:
- Icon: BarChart3 (lucide-react)
- Route: `/analytics`
- Translation keys:
  - English: "Analytics"
  - Indonesian: "Analitik"

## Usage Example

### Recording User Information

When making requests through the proxy, you can now track which user made the request. The analytics will automatically capture:

1. **User**: Email or identifier from OAuth token
2. **Provider**: Which AI provider was used (Google, Anthropic, etc.)
3. **Model**: Which model was requested
4. **Account**: Which account token was used
5. **Tokens**: Input/output token counts
6. **Cost**: Calculated based on pricing data
7. **Success**: Whether the request succeeded

### Viewing Analytics

1. Start the GUI: `./betacliproxyapi gui`
2. Navigate to the "Analytics" tab
3. View:
   - Overall usage trends
   - Activity heatmap (daily breakdown)
   - Per-user statistics
   - Detailed request logs with all metadata

## Technical Details

### Database Schema
```sql
CREATE TABLE request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    source TEXT,
    model TEXT,
    provider TEXT,
    account_id TEXT,
    user TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    success INTEGER,
    error TEXT
);

CREATE INDEX idx_request_logs_ts ON request_logs(ts);
CREATE INDEX idx_request_logs_model ON request_logs(model);
CREATE INDEX idx_request_logs_provider ON request_logs(provider);
CREATE INDEX idx_request_logs_user ON request_logs(user);
CREATE INDEX idx_request_logs_account ON request_logs(account_id);
```

### Heatmap Level Calculation
Levels are calculated based on the ratio of requests to the maximum:
- Level 0: No activity (0%)
- Level 1: Low activity (>0% to 25%)
- Level 2: Medium-low activity (>25% to 50%)
- Level 3: Medium-high activity (>50% to 75%)
- Level 4: High activity (>75% to 100%)

## Benefits

1. **User Accountability**: Track which users are making requests
2. **Cost Management**: See cost breakdown by user and model
3. **Usage Patterns**: Identify peak usage times via heatmap
4. **Provider Distribution**: See which providers are most used
5. **Performance Monitoring**: Track latency and success rates per user
6. **Detailed Audit Trail**: Complete request history with all metadata

## Migration Notes

- Existing databases will be automatically migrated
- No manual SQL execution required
- Backward compatible with existing code
- If migration fails, delete `~/.cli-proxy-api/dataproxy.db` and restart

## Building

```bash
# Build React GUI
cd gui
npm install
npm run build

# Build Go binary (embeds GUI assets)
cd ..
go build -o betacliproxyapi ./cmd/betacliproxyapi

# Run
./betacliproxyapi gui
```

## Future Enhancements

Potential additions:
- Export analytics to CSV/JSON
- Custom date range filtering
- Real-time WebSocket updates
- Cost alerts and budgets
- Team/organization grouping
- Model comparison charts
