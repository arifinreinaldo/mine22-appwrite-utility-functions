import { Client, Storage, Query } from 'node-appwrite';

/**
 * Daily Cron Job Function
 * Runs every day at 23:59
 *
 * This function is executed automatically by Appwrite's cron scheduler.
 * Add your custom logic below to perform daily tasks.
 */
export default async ({ req, res, log, error }) => {
  try {
    // Initialize Appwrite client
    const apiKey = process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'] || '';
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;

    if (!apiKey) {
      throw new Error('APPWRITE_API_KEY environment variable is required');
    }

    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    // Initialize Storage service
    const storage = new Storage(client);

    // Get bucket ID from environment variable or use default
    const bucketId = process.env.STORAGE_BUCKET_ID || 'default';

    // Get max file age from environment variable (in seconds)
    const maxAgeSeconds = parseInt(process.env.FILE_MAX_AGE_SECONDS || '86400', 10);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setTime(cutoffDate.getTime() - (maxAgeSeconds * 1000));
    const cutoffTime = cutoffDate.getTime();

    log(`Starting cleanup: bucket=${bucketId}, maxAge=${maxAgeSeconds}s`);

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
        const filesList = await storage.listFiles(
          bucketId,
          [
            Query.limit(limit),
            Query.offset(offset)
          ]
        );

        totalScanned += filesList.files.length;

        // Process each file
        for (const file of filesList.files) {
          try {
            const fileCreatedAt = new Date(file.$createdAt).getTime();

            // Check if file name starts with "temp" and is older than threshold
            if (file.name.toLowerCase().startsWith('temp') && fileCreatedAt < cutoffTime) {
              await storage.deleteFile(bucketId, file.$id);

              totalDeleted++;
              deletedFiles.push({
                id: file.$id,
                name: file.name,
                createdAt: file.$createdAt,
                size: file.sizeOriginal
              });

              log(`Deleted: ${file.name}`);
            }
          } catch (fileError) {
            totalErrors++;
            error(`Failed to delete ${file.name}: ${fileError.message}`);
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
        error(`Error listing files: ${listError.message}`);
        totalErrors++;
        errors.push({
          operation: 'listFiles',
          error: listError.message
        });
        hasMore = false;
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

    log(`Completed: ${totalDeleted} deleted, ${totalErrors} errors`);

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
