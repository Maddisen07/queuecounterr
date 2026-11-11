import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    number: {
      type: Number,
      required: true
    },
    day: {
      type: String,
      required: true,
      index: true
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: [60, 'Customer name cannot exceed 60 characters'],
      default: ''
    },
    note: {
      type: String,
      trim: true,
      maxlength: [120, 'Note cannot exceed 120 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: ['waiting', 'serving', 'completed', 'cancelled', 'no_show'],
      default: 'waiting',
      index: true
    },
    counter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      default: null
    },
    calledAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    serviceDurationSec: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index for day + number
tokenSchema.index({ day: 1, number: 1 }, { unique: true });
// Index for queue querying
tokenSchema.index({ status: 1, createdAt: 1 });

export const Token = mongoose.model('Token', tokenSchema);
