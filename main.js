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
    // Log the execution start
    log('Daily cron job started at: ' + new Date().toISOString());

    // Initialize Appwrite client
    const apiKey = process.env.APPWRITE_API_KEY || req.headers['x-appwrite-key'] || '';
    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;

    log('Starting cleanup of temporary files...');
    log('Endpoint: ' + endpoint);
    log('Project ID: ' + projectId);
    log('API Key set: ' + (apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No - MISSING!'));

    if (!apiKey) {
      error('❌ CRITICAL: APPWRITE_API_KEY is not set!');
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
        log(`Attempting to list files: bucketId="${bucketId}", offset=${offset}, limit=${limit}`);

        // Use REST API directly to bypass SDK issues
        let filesList;
        if (offset === 0) {
          log('Using direct REST API call instead of SDK...');

          // Make direct API call using fetch
          const url = `${endpoint}/storage/buckets/${bucketId}/files`;
          log(`Calling: GET ${url}`);

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-Appwrite-Project': projectId,
              'X-Appwrite-Key': apiKey,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }

          filesList = await response.json();
          log(`Direct API call successful!`);
        } else {
          // For now, stop pagination after first batch
          hasMore = false;
          break;
        }

        log(`Response: Found ${filesList.files.length} files in this batch, ${filesList.total} total files in bucket`);

        if (filesList.total === 0 && offset === 0) {
          log('⚠ Warning: Bucket appears to be empty (0 files found)');
          log('⚠ This could mean:');
          log('  1. The bucket is actually empty');
          log('  2. The bucket ID is incorrect');
          log('  3. The API key lacks permission to list files in this bucket');
        }

        totalScanned += filesList.files.length;

        // Process each file
        for (const file of filesList.files) {
          try {
            const fileCreatedAt = new Date(file.$createdAt).getTime();
            const fileAgeSeconds = Math.floor((Date.now() - fileCreatedAt) / 1000);

            // Log all files being scanned
            log(`Scanning: ${file.name} (Age: ${fileAgeSeconds}s, Created: ${file.$createdAt})`);

            // Check if file name starts with "temp"
            if (file.name.toLowerCase().startsWith('temp')) {
              log(`  → Matches temp prefix`);

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

                log(`  ✓ Deleted: ${file.name} (Age: ${fileAgeSeconds}s exceeded ${maxAgeSeconds}s threshold)`);
              } else {
                log(`  ✗ Skipped: ${file.name} (Age: ${fileAgeSeconds}s < ${maxAgeSeconds}s threshold)`);
              }
            } else {
              log(`  → Does not match temp prefix, skipping`);
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

        // For now, only process first batch (no pagination until Query API works)
        hasMore = false;
        log('Note: Pagination temporarily disabled - processing first batch only');

      } catch (listError) {
        error('❌ Error listing files from bucket: ' + listError.message);
        error('Error details: ' + JSON.stringify({
          message: listError.message,
          code: listError.code,
          type: listError.type,
          response: listError.response
        }));
        totalErrors++;
        errors.push({
          operation: 'listFiles',
          bucketId: bucketId,
          error: listError.message,
          code: listError.code
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
