/**
 * Utility script to recreate all missing MySQL VIEWs for segments stored in MongoDB
 *
 * This script:
 * 1. Connects to MongoDB and fetches all non-deleted segments
 * 2. For each segment with originalPrompt, calls the CRM backend refresh endpoint
 * 3. Recreates the MySQL VIEW for the segment
 *
 * Run with: node api/scripts/recreate-segment-views.js
 */

const axios = require('axios');
const { connectDb, logger } = require('@librechat/data-schemas');
const { getSegments } = require('../models/Segment');

const CRM_BACKEND_URL = process.env.CRM_BACKEND_URL || 'http://localhost:8001';

async function recreateSegmentViews() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDb();
    logger.info('Connected to MongoDB');

    // Get all segments
    logger.info('Fetching segments from MongoDB...');
    const segments = await getSegments();
    logger.info(`Found ${segments.length} segments in MongoDB`);

    // Filter segments that have originalPrompt and viewName
    const validSegments = segments.filter((s) => !s.isDeleted && s.originalPrompt && s.viewName);
    logger.info(`Found ${validSegments.length} valid segments to recreate`);

    if (validSegments.length === 0) {
      logger.info('No segments to recreate. Exiting.');
      process.exit(0);
    }

    // Recreate each VIEW
    let successCount = 0;
    let failCount = 0;

    for (const segment of validSegments) {
      try {
        logger.info(
          `\n[${successCount + failCount + 1}/${validSegments.length}] Processing segment: ${segment.name}`,
        );
        logger.info(`  - Segment ID: ${segment.segmentId}`);
        logger.info(`  - View Name: ${segment.viewName}`);
        logger.info(`  - Original Prompt: ${segment.originalPrompt}`);

        const currentDate = new Date().toISOString().split('T')[0];

        // Call CRM backend refresh endpoint
        const response = await axios.post(
          `${CRM_BACKEND_URL}/api/segments/${segment.segmentId}/refresh`,
          {
            originalDescription: segment.originalPrompt,
            currentDate,
          },
          {
            timeout: 30000, // 30 second timeout
          },
        );

        logger.info(`  ✓ Successfully recreated VIEW: ${response.data.viewName}`);
        successCount++;
      } catch (error) {
        logger.error(`  ✗ Failed to recreate VIEW for segment ${segment.name}:`);
        logger.error(`    ${error.response?.data?.detail || error.message}`);
        failCount++;
      }
    }

    // Summary
    logger.info('\n========================================');
    logger.info('SUMMARY');
    logger.info('========================================');
    logger.info(`Total segments processed: ${validSegments.length}`);
    logger.info(`Successfully recreated: ${successCount}`);
    logger.info(`Failed: ${failCount}`);
    logger.info('========================================\n');

    if (successCount > 0) {
      logger.info('✓ VIEWs have been recreated. The /segments page should now display data.');
    }

    if (failCount > 0) {
      logger.warn('⚠ Some VIEWs failed to recreate. Check the errors above.');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
recreateSegmentViews();
