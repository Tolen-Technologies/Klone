import type { Document, Types } from 'mongoose';

/**
 * Represents the AI-generated personality profile for a customer.
 */
export interface CustomerPersonality {
  summary: string;
  preferences: string;
  generatedAt?: Date;
}

/**
 * Represents a recorded interaction transcript.
 */
export interface CustomerTranscript {
  id: string;
  filename: string;
  content: string;
  createdAt: Date;
}

/**
 * Represents a bookmarked fact extracted from a transcript.
 */
export interface BookmarkedFact {
  id: string;
  text: string;
  transcriptId?: string;
  createdAt: Date;
}

/**
 * Represents a customer profile linked to a MySQL customer record.
 */
export interface CustomerProfile {
  mysqlCustomerId: number;
  personality: CustomerPersonality;
  notes: string;
  transcripts: CustomerTranscript[];
  bookmarkedFacts: BookmarkedFact[];
  conversationId?: string;
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB document interface for CustomerProfile.
 */
export interface ICustomerProfile extends Document {
  _id: Types.ObjectId;
  mysqlCustomerId: number;
  personality: CustomerPersonality;
  notes: string;
  transcripts: CustomerTranscript[];
  bookmarkedFacts: BookmarkedFact[];
  conversationId?: string;
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lean version of ICustomerProfile for query results.
 */
export interface ICustomerProfileLean {
  _id: Types.ObjectId;
  mysqlCustomerId: number;
  personality: CustomerPersonality;
  notes: string;
  transcripts: CustomerTranscript[];
  bookmarkedFacts: BookmarkedFact[];
  conversationId?: string;
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parameters for upserting a customer profile.
 */
export interface UpsertCustomerProfileParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
  personality?: Partial<CustomerPersonality>;
  notes?: string;
  conversationId?: string;
}

/**
 * Parameters for updating customer notes.
 */
export interface UpdateCustomerNotesParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
  notes: string;
}

/**
 * Parameters for updating customer personality.
 */
export interface UpdateCustomerPersonalityParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
  personality: CustomerPersonality;
}

/**
 * Parameters for getting a customer profile by customer ID.
 */
export interface GetCustomerProfileParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
}

/**
 * Parameters for adding a transcript.
 */
export interface AddTranscriptParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
  filename: string;
  content: string;
}

/**
 * Parameters for adding a bookmarked fact.
 */
export interface AddBookmarkedFactParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
  text: string;
  transcriptId?: string;
}

/**
 * Parameters for removing a bookmarked fact.
 */
export interface RemoveBookmarkedFactParams {
  mysqlCustomerId: number;
  userId: string | Types.ObjectId;
  factId: string;
}
