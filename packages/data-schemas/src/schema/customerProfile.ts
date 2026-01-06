import { Schema } from 'mongoose';
import type {
  ICustomerProfile,
  CustomerPersonality,
  CustomerTranscript,
  BookmarkedFact,
} from '~/types';

const customerPersonalitySchema = new Schema<CustomerPersonality>(
  {
    summary: {
      type: String,
      default: '',
    },
    preferences: {
      type: String,
      default: '',
    },
    generatedAt: {
      type: Date,
    },
  },
  { _id: false },
);

const customerTranscriptSchema = new Schema<CustomerTranscript>(
  {
    id: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const bookmarkedFactSchema = new Schema<BookmarkedFact>(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    transcriptId: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const customerProfileSchema = new Schema<ICustomerProfile>(
  {
    mysqlCustomerId: {
      type: Number,
      required: true,
      index: true,
    },
    personality: {
      type: customerPersonalitySchema,
      default: () => ({
        summary: '',
        preferences: '',
      }),
    },
    notes: {
      type: String,
      default: '',
    },
    transcripts: {
      type: [customerTranscriptSchema],
      default: [],
    },
    bookmarkedFacts: {
      type: [bookmarkedFactSchema],
      default: [],
    },
    conversationId: {
      type: String,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound unique index for mysqlCustomerId + user (multi-tenancy)
customerProfileSchema.index({ mysqlCustomerId: 1, user: 1 }, { unique: true });
customerProfileSchema.index({ createdAt: -1 });
customerProfileSchema.index({ updatedAt: -1 });

export default customerProfileSchema;
