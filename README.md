# Appwrite Daily Cron Function

An Appwrite Cloud Function that runs automatically every day at 23:59 SGT (Singapore Time).

## Overview

This function is designed to execute scheduled daily tasks at the end of each day. The cron schedule is set to run at 23:59 in Singapore Time (SGT/UTC+8).

## Configuration

### Cron Schedule
- **Schedule**: `59 23 * * *`
- **Frequency**: Daily
- **Time**: 23:59 (11:59 PM)
- **Timezone**: SGT (Singapore Time - UTC+8)

### Function Settings
- **Runtime**: Node.js 18.0
- **Timeout**: 60 seconds
- **Entrypoint**: `src/main.js`

## Setup Instructions

### 1. Update Project Configuration

Edit `appwrite.json` and replace `"your-project-id"` with your actual Appwrite project ID:

```json
"projectId": "your-actual-project-id"
```

### 2. Set Environment Variables

In your Appwrite Console, configure the following environment variables for this function:

- `APPWRITE_API_KEY` - API key with necessary permissions for your tasks

### 3. Deploy the Function

Using Appwrite CLI:

```bash
# Install dependencies
npm install

# Deploy the function
appwrite deploy function
```

Or deploy directly from the Appwrite Console by uploading this code.

### 4. Verify Timezone

**Important**: Appwrite functions run based on the server's timezone. To ensure the function runs at 23:59 SGT:

- Verify your Appwrite instance timezone settings
- Adjust the cron schedule if needed based on your server's timezone
- For Appwrite Cloud, the default timezone is typically UTC

If your server is in UTC, to run at 23:59 SGT (UTC+8), the cron should be:
```
59 15 * * *  # 15:59 UTC = 23:59 SGT
```

## Customization

### Adding Your Daily Tasks

Edit `src/main.js` and add your custom logic in the designated section:

```javascript
// ============================================
// ADD YOUR CUSTOM DAILY CRON LOGIC HERE
// ============================================

// Example tasks:
const databases = new Databases(client);

// Clean up old data
await databases.deleteDocument('database-id', 'collection-id', 'document-id');

// Generate reports
// Send notifications
// Backup data
```

### Common Use Cases

- **Data Cleanup**: Remove old or expired records
- **Daily Reports**: Generate and send daily statistics
- **Notifications**: Send end-of-day notifications to users
- **Backups**: Create daily backups of important data
- **Analytics**: Update daily analytics and metrics
- **Batch Processing**: Process accumulated data from the day

## Function Structure

```
.
├── appwrite.json         # Appwrite function configuration
├── package.json          # Node.js dependencies
├── src/
│   └── main.js          # Main function code
└── README.md            # This file
```

## Monitoring

### Logs

View function execution logs in the Appwrite Console:
1. Go to Functions
2. Select "Daily Cron Function"
3. Click on "Executions" tab

### Success Response

```json
{
  "success": true,
  "data": {
    "success": true,
    "executedAt": "2026-01-09T15:59:00.000Z",
    "message": "Daily cron job completed successfully",
    "tasksCompleted": ["..."]
  },
  "timestamp": "2026-01-09T15:59:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2026-01-09T15:59:00.000Z"
}
```

## Troubleshooting

### Function Not Running at Expected Time

1. Check the cron schedule in `appwrite.json`
2. Verify the server timezone in Appwrite settings
3. Check function logs for any errors
4. Ensure the function is enabled

### Permission Errors

1. Verify `APPWRITE_API_KEY` has necessary permissions
2. Check execution role settings in function configuration

### Timeout Issues

If tasks take longer than 60 seconds:
1. Increase timeout in `appwrite.json`
2. Optimize your code
3. Consider breaking tasks into smaller chunks

## License

MIT
