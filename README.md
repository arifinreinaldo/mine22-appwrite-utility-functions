# Appwrite Daily Storage Cleanup Function

An Appwrite Cloud Function that runs automatically every day at 23:59 SGT (Singapore Time) to clean up temporary storage files.

## Overview

This function automatically deletes temporary storage files that are older than 1 day. It scans your storage bucket for files with names starting with the prefix "temp" (e.g., `temp-2026-01-11-image.jpg`) and removes any files that were uploaded more than 24 hours ago.

## Configuration

### Cron Schedule
- **Schedule**: `59 23 * * *`
- **Frequency**: Daily
- **Time**: 23:59 (11:59 PM)
- **Timezone**: SGT (Singapore Time - UTC+8)

### Function Settings
- **Runtime**: Node.js 18.0
- **Timeout**: 60 seconds
- **Entrypoint**: `main.js`

## Setup Instructions

### 1. Project Configuration

The project is already configured with project ID: `694172460017e01592a1`

### 2. Set Environment Variables

In your Appwrite Console, configure the following environment variables for this function:

- `APPWRITE_API_KEY` - API key with **storage delete permissions** (required)
- `STORAGE_BUCKET_ID` - The ID of the storage bucket to clean up (defaults to "default" if not set)

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

## How It Works

### Cleanup Logic

1. **Scans Storage Bucket**: Lists all files in the configured storage bucket
2. **Filters by Prefix**: Identifies files with names starting with "temp" (case-insensitive)
3. **Checks Age**: Compares file creation date against 24-hour threshold
4. **Deletes Old Files**: Removes files older than 1 day
5. **Reports Results**: Logs detailed statistics and any errors

### File Naming Pattern

Files matching this pattern will be cleaned up:
- `temp-2026-01-11-image.jpg` ✓
- `temp_document.pdf` ✓
- `TEMP-file.png` ✓
- `temporary.txt` ✗ (doesn't start with "temp")
- `my-temp.jpg` ✗ (doesn't start with "temp")

### Pagination

The function processes files in batches of 100 to handle large storage buckets efficiently without timing out.

## Function Structure

```
.
├── appwrite.json         # Appwrite function configuration
├── package.json          # Node.js dependencies
├── main.js              # Main function code
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
    "message": "Cleanup completed: 5 files deleted, 0 errors",
    "statistics": {
      "totalScanned": 150,
      "totalDeleted": 5,
      "totalErrors": 0,
      "cutoffDate": "2026-01-08T15:59:00.000Z",
      "bucketId": "default"
    },
    "deletedFiles": [
      {
        "id": "file-id-1",
        "name": "temp-2026-01-07-image.jpg",
        "createdAt": "2026-01-07T10:30:00.000Z",
        "size": 102400
      }
    ]
  },
  "timestamp": "2026-01-09T15:59:00.000Z"
}
```

### Response with Errors

```json
{
  "success": true,
  "data": {
    "success": false,
    "executedAt": "2026-01-09T15:59:00.000Z",
    "message": "Cleanup completed: 3 files deleted, 2 errors",
    "statistics": {
      "totalScanned": 100,
      "totalDeleted": 3,
      "totalErrors": 2,
      "cutoffDate": "2026-01-08T15:59:00.000Z",
      "bucketId": "default"
    },
    "errors": [
      {
        "file": "temp-locked.jpg",
        "fileId": "file-id-xyz",
        "error": "Permission denied"
      }
    ]
  },
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

1. Verify `APPWRITE_API_KEY` has **storage delete permissions**
2. Check that the API key has access to the specified bucket
3. Ensure the function execution role has proper permissions

### No Files Being Deleted

1. Verify files start with "temp" prefix (case-insensitive)
2. Check that files are actually older than 24 hours
3. Confirm the correct `STORAGE_BUCKET_ID` is set
4. Review function logs to see what files are being scanned

### Timeout Issues

If the function times out with large storage buckets:
1. Increase timeout in `appwrite.json` (max varies by plan)
2. The function processes 100 files per batch to minimize timeout risk
3. Consider running the function more frequently (e.g., every 12 hours)

### Wrong Bucket Being Cleaned

1. Check the `STORAGE_BUCKET_ID` environment variable
2. If not set, it defaults to "default"
3. Verify the bucket ID in function logs

## License

MIT
