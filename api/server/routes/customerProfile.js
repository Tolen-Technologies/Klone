const express = require('express');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const {
  getCustomerProfileByCustomerId,
  upsertCustomerProfile,
  addTranscript,
  getTranscripts,
  addBookmarkedFact,
  getBookmarkedFacts,
  removeBookmarkedFact,
} = require('~/models');

const router = express.Router();

// All routes require authentication
router.use(requireJwtAuth);

/**
 * GET /api/customer-profile/:customerId
 * Get customer profile by MySQL customer ID
 */
router.get('/:customerId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const profile = await getCustomerProfileByCustomerId({
      mysqlCustomerId: customerId,
      userId,
    });

    res.status(200).json(profile);
  } catch (error) {
    logger.error('[GET /customer-profile/:customerId] Error:', error);
    res.status(500).json({ error: 'Failed to fetch customer profile' });
  }
});

/**
 * PUT /api/customer-profile/:customerId
 * Upsert customer profile (personality, notes, conversationId)
 */
router.put('/:customerId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;
    const { personality, notes, conversationId } = req.body;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const profile = await upsertCustomerProfile({
      mysqlCustomerId: customerId,
      userId,
      personality,
      notes,
      conversationId,
    });

    res.status(200).json(profile);
  } catch (error) {
    logger.error('[PUT /customer-profile/:customerId] Error:', error);
    res.status(500).json({ error: 'Failed to update customer profile' });
  }
});

/**
 * PUT /api/customer-profile/:customerId/notes
 * Update only notes field (for auto-save) - uses upsert to create profile if not exists
 */
router.put('/:customerId/notes', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;
    const { notes } = req.body;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    if (notes === undefined) {
      return res.status(400).json({ error: 'Notes field is required' });
    }

    // Use upsert to create profile if it doesn't exist
    const profile = await upsertCustomerProfile({
      mysqlCustomerId: customerId,
      userId,
      notes,
    });

    res.status(200).json(profile);
  } catch (error) {
    logger.error('[PUT /customer-profile/:customerId/notes] Error:', error);
    res.status(500).json({ error: 'Failed to update customer notes' });
  }
});

/**
 * PUT /api/customer-profile/:customerId/personality
 * Update only personality field - uses upsert to create profile if not exists
 */
router.put('/:customerId/personality', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;
    const { summary, preferences } = req.body;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    if (!summary || !preferences) {
      return res.status(400).json({ error: 'Summary and preferences are required' });
    }

    // Use upsert to create profile if it doesn't exist
    const profile = await upsertCustomerProfile({
      mysqlCustomerId: customerId,
      userId,
      personality: {
        summary,
        preferences,
        generatedAt: new Date(),
      },
    });

    res.status(200).json(profile);
  } catch (error) {
    logger.error('[PUT /customer-profile/:customerId/personality] Error:', error);
    res.status(500).json({ error: 'Failed to update customer personality' });
  }
});

/**
 * GET /api/customer-profile/:customerId/transcripts
 * Get all transcripts for a customer
 */
router.get('/:customerId/transcripts', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const transcripts = await getTranscripts({
      mysqlCustomerId: customerId,
      userId,
    });

    res.status(200).json(transcripts);
  } catch (error) {
    logger.error('[GET /customer-profile/:customerId/transcripts] Error:', error);
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

/**
 * POST /api/customer-profile/:customerId/transcripts
 * Add a new transcript to a customer profile
 */
router.post('/:customerId/transcripts', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;
    const { filename, content } = req.body;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    if (!filename || !content) {
      return res.status(400).json({ error: 'Filename and content are required' });
    }

    const transcript = await addTranscript({
      mysqlCustomerId: customerId,
      userId,
      filename,
      content,
    });

    res.status(201).json(transcript);
  } catch (error) {
    logger.error('[POST /customer-profile/:customerId/transcripts] Error:', error);
    res.status(500).json({ error: 'Failed to add transcript' });
  }
});

/**
 * GET /api/customer-profile/:customerId/bookmarks
 * Get all bookmarked facts for a customer
 */
router.get('/:customerId/bookmarks', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const bookmarks = await getBookmarkedFacts({
      mysqlCustomerId: customerId,
      userId,
    });

    res.status(200).json(bookmarks);
  } catch (error) {
    logger.error('[GET /customer-profile/:customerId/bookmarks] Error:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

/**
 * POST /api/customer-profile/:customerId/bookmarks
 * Add a new bookmarked fact to a customer profile
 */
router.post('/:customerId/bookmarks', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;
    const { text, transcriptId } = req.body;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const bookmark = await addBookmarkedFact({
      mysqlCustomerId: customerId,
      userId,
      text,
      transcriptId,
    });

    res.status(201).json(bookmark);
  } catch (error) {
    logger.error('[POST /customer-profile/:customerId/bookmarks] Error:', error);
    res.status(500).json({ error: 'Failed to add bookmark' });
  }
});

/**
 * DELETE /api/customer-profile/:customerId/bookmarks/:factId
 * Remove a bookmarked fact from a customer profile
 */
router.delete('/:customerId/bookmarks/:factId', async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const userId = req.user.id;
    const { factId } = req.params;

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    if (!factId) {
      return res.status(400).json({ error: 'Fact ID is required' });
    }

    const success = await removeBookmarkedFact({
      mysqlCustomerId: customerId,
      userId,
      factId,
    });

    if (success) {
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ error: 'Bookmark not found' });
    }
  } catch (error) {
    logger.error('[DELETE /customer-profile/:customerId/bookmarks/:factId] Error:', error);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

module.exports = router;
