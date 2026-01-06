import { Types } from 'mongoose';
import logger from '~/config/winston';
import type * as t from '~/types';

// Factory function that takes mongoose instance and returns the methods
export function createCustomerProfileMethods(mongoose: typeof import('mongoose')) {
  /**
   * Gets a customer profile by MySQL customer ID and user
   */
  async function getCustomerProfileByCustomerId({
    mysqlCustomerId,
    userId,
  }: t.GetCustomerProfileParams): Promise<t.ICustomerProfileLean | null> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      return (await CustomerProfile.findOne({
        mysqlCustomerId,
        user: userObjectId,
      }).lean()) as t.ICustomerProfileLean | null;
    } catch (error) {
      logger.error('Failed to get customer profile:', error);
      throw new Error(
        `Failed to get customer profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Upserts a customer profile (creates if not exists, updates if exists)
   */
  async function upsertCustomerProfile({
    mysqlCustomerId,
    userId,
    personality,
    notes,
    conversationId,
  }: t.UpsertCustomerProfileParams): Promise<t.ICustomerProfileLean> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const updateData: Record<string, unknown> = {};

      if (personality !== undefined) {
        if (personality.summary !== undefined) {
          updateData['personality.summary'] = personality.summary;
        }
        if (personality.preferences !== undefined) {
          updateData['personality.preferences'] = personality.preferences;
        }
        if (personality.generatedAt !== undefined) {
          updateData['personality.generatedAt'] = personality.generatedAt;
        }
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      if (conversationId !== undefined) {
        updateData.conversationId = conversationId;
      }

      const result = await CustomerProfile.findOneAndUpdate(
        { mysqlCustomerId, user: userObjectId },
        {
          $set: updateData,
          $setOnInsert: {
            mysqlCustomerId,
            user: userObjectId,
          },
        },
        {
          upsert: true,
          new: true,
          lean: true,
        },
      );

      return result as t.ICustomerProfileLean;
    } catch (error) {
      logger.error('Failed to upsert customer profile:', error);
      throw new Error(
        `Failed to upsert customer profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates only the notes field for a customer profile
   */
  async function updateCustomerNotes({
    mysqlCustomerId,
    userId,
    notes,
  }: t.UpdateCustomerNotesParams): Promise<t.ICustomerProfileLean | null> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const result = await CustomerProfile.findOneAndUpdate(
        { mysqlCustomerId, user: userObjectId },
        { $set: { notes } },
        { new: true, lean: true },
      );

      return result as t.ICustomerProfileLean | null;
    } catch (error) {
      logger.error('Failed to update customer notes:', error);
      throw new Error(
        `Failed to update customer notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Updates only the personality field for a customer profile
   */
  async function updateCustomerPersonality({
    mysqlCustomerId,
    userId,
    personality,
  }: t.UpdateCustomerPersonalityParams): Promise<t.ICustomerProfileLean | null> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const result = await CustomerProfile.findOneAndUpdate(
        { mysqlCustomerId, user: userObjectId },
        {
          $set: {
            'personality.summary': personality.summary,
            'personality.preferences': personality.preferences,
            'personality.generatedAt': personality.generatedAt || new Date(),
          },
        },
        { new: true, lean: true },
      );

      return result as t.ICustomerProfileLean | null;
    } catch (error) {
      logger.error('Failed to update customer personality:', error);
      throw new Error(
        `Failed to update customer personality: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deletes a customer profile
   */
  async function deleteCustomerProfile({
    mysqlCustomerId,
    userId,
  }: t.GetCustomerProfileParams): Promise<boolean> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const result = await CustomerProfile.findOneAndDelete({
        mysqlCustomerId,
        user: userObjectId,
      });

      return !!result;
    } catch (error) {
      logger.error('Failed to delete customer profile:', error);
      throw new Error(
        `Failed to delete customer profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Adds a transcript to a customer profile
   */
  async function addTranscript({
    mysqlCustomerId,
    userId,
    filename,
    content,
  }: t.AddTranscriptParams): Promise<t.CustomerTranscript> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const transcript: t.CustomerTranscript = {
        id: new Types.ObjectId().toString(),
        filename,
        content,
        createdAt: new Date(),
      };

      await CustomerProfile.findOneAndUpdate(
        { mysqlCustomerId, user: userObjectId },
        {
          $push: { transcripts: transcript },
          $setOnInsert: {
            mysqlCustomerId,
            user: userObjectId,
          },
        },
        { upsert: true },
      );

      return transcript;
    } catch (error) {
      logger.error('Failed to add transcript:', error);
      throw new Error(
        `Failed to add transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets all transcripts for a customer profile
   */
  async function getTranscripts({
    mysqlCustomerId,
    userId,
  }: t.GetCustomerProfileParams): Promise<t.CustomerTranscript[]> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const profile = await CustomerProfile.findOne({
        mysqlCustomerId,
        user: userObjectId,
      }).lean();

      return (profile as t.ICustomerProfileLean | null)?.transcripts || [];
    } catch (error) {
      logger.error('Failed to get transcripts:', error);
      throw new Error(
        `Failed to get transcripts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Adds a bookmarked fact to a customer profile
   */
  async function addBookmarkedFact({
    mysqlCustomerId,
    userId,
    text,
    transcriptId,
  }: t.AddBookmarkedFactParams): Promise<t.BookmarkedFact> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const fact: t.BookmarkedFact = {
        id: new Types.ObjectId().toString(),
        text,
        transcriptId,
        createdAt: new Date(),
      };

      await CustomerProfile.findOneAndUpdate(
        { mysqlCustomerId, user: userObjectId },
        {
          $push: { bookmarkedFacts: fact },
          $setOnInsert: {
            mysqlCustomerId,
            user: userObjectId,
          },
        },
        { upsert: true },
      );

      return fact;
    } catch (error) {
      logger.error('Failed to add bookmarked fact:', error);
      throw new Error(
        `Failed to add bookmarked fact: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets all bookmarked facts for a customer profile
   */
  async function getBookmarkedFacts({
    mysqlCustomerId,
    userId,
  }: t.GetCustomerProfileParams): Promise<t.BookmarkedFact[]> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const profile = await CustomerProfile.findOne({
        mysqlCustomerId,
        user: userObjectId,
      }).lean();

      return (profile as t.ICustomerProfileLean | null)?.bookmarkedFacts || [];
    } catch (error) {
      logger.error('Failed to get bookmarked facts:', error);
      throw new Error(
        `Failed to get bookmarked facts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Removes a bookmarked fact from a customer profile
   */
  async function removeBookmarkedFact({
    mysqlCustomerId,
    userId,
    factId,
  }: t.RemoveBookmarkedFactParams): Promise<boolean> {
    try {
      const CustomerProfile = mongoose.models.CustomerProfile;
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const result = await CustomerProfile.findOneAndUpdate(
        { mysqlCustomerId, user: userObjectId },
        { $pull: { bookmarkedFacts: { id: factId } } },
      );

      return !!result;
    } catch (error) {
      logger.error('Failed to remove bookmarked fact:', error);
      throw new Error(
        `Failed to remove bookmarked fact: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return {
    getCustomerProfileByCustomerId,
    upsertCustomerProfile,
    updateCustomerNotes,
    updateCustomerPersonality,
    deleteCustomerProfile,
    addTranscript,
    getTranscripts,
    addBookmarkedFact,
    getBookmarkedFacts,
    removeBookmarkedFact,
  };
}

export type CustomerProfileMethods = ReturnType<typeof createCustomerProfileMethods>;
