import { Client, Storage } from 'node-appwrite';

/**
 * Daily Cron Job Function
 * Runs every day at 23:59
 *
 * This function is executed automatically by Appwrite's cron scheduler.
 * Add your custom logic below to perform daily tasks.
 */
export default async ({ req, res, log, error }) => {
  try {
    // Log the execution start
    log('Daily cron job started at: ' + new Date().toISOString());

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'] || '');

    // Initialize Storage service
    const storage = new Storage(client);

    // Get bucket ID from environment variable or use default
    const bucketId = process.env.STORAGE_BUCKET_ID || 'default';

    log('Starting cleanup of temporary files...');
    log('Bucket ID: ' + bucketId);

    // Get max file age from environment variable (in seconds)
    // Default: 86400 seconds = 24 hours = 1 day
    const maxAgeSeconds = parseInt(process.env.FILE_MAX_AGE_SECONDS || '86400', 10);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setTime(cutoffDate.getTime() - (maxAgeSeconds * 1000));
    const cutoffTime = cutoffDate.getTime();

    log('Max file age: ' + maxAgeSeconds + ' seconds (' + (maxAgeSeconds / 3600).toFixed(2) + ' hours)');
    log('Cutoff time: ' + cutoffDate.toISOString());

    // Track cleanup statistics
    let totalScanned = 0;
    let totalDeleted = 0;
    let totalErrors = 0;
    const deletedFiles = [];
    const errors = [];

    // List all files in the bucket
    let hasMore = true;
    let offset = 0;
    const limit = 100; // Process 100 files at a time

    while (hasMore) {
      try {
        // List files with pagination
        const filesList = await storage.listFiles(bucketId, [], limit, offset);

        log(`Processing batch: ${offset} to ${offset + filesList.files.length} of ${filesList.total}`);

        totalScanned += filesList.files.length;

        // Process each file
        for (const file of filesList.files) {
          try {
            // Check if file name starts with "temp"
            if (file.name.toLowerCase().startsWith('temp')) {
              // Check if file is older than 1 day
              const fileCreatedAt = new Date(file.$createdAt).getTime();

              if (fileCreatedAt < cutoffTime) {
                // Delete the file
                await storage.deleteFile(bucketId, file.$id);

                totalDeleted++;
                deletedFiles.push({
                  id: file.$id,
                  name: file.name,
                  createdAt: file.$createdAt,
                  size: file.sizeOriginal
                });

                log(`Deleted: ${file.name} (ID: ${file.$id}, Created: ${file.$createdAt})`);
              }
            }
          } catch (fileError) {
            totalErrors++;
            const errorMsg = `Failed to delete file ${file.name}: ${fileError.message}`;
            error(errorMsg);
            errors.push({
              file: file.name,
              fileId: file.$id,
              error: fileError.message
            });
          }
        }

        // Check if there are more files to process
        hasMore = filesList.files.length === limit;
        offset += limit;

      } catch (listError) {
        error('Error listing files: ' + listError.message);
        errors.push({
          operation: 'listFiles',
          error: listError.message
        });
        hasMore = false; // Stop on list error
      }
    }

    const executionTime = new Date().toISOString();
    const result = {
      success: totalErrors === 0,
      executedAt: executionTime,
      message: `Cleanup completed: ${totalDeleted} files deleted, ${totalErrors} errors`,
      statistics: {
        totalScanned,
        totalDeleted,
        totalErrors,
        maxAgeSeconds,
        cutoffDate: cutoffDate.toISOString(),
        bucketId
      },
      deletedFiles: deletedFiles.length > 0 ? deletedFiles : undefined,
      errors: errors.length > 0 ? errors : undefined
    };

    log(`Cleanup completed: Scanned ${totalScanned}, Deleted ${totalDeleted}, Errors ${totalErrors}`);

    // Return success response
    return res.json({
      success: true,
      data: result,
      timestamp: executionTime
    });

  } catch (err) {
    // Log and return error
    error('Error in daily cron job: ' + err.message);
    error(err.stack);

    return res.json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
};
