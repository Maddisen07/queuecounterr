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
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [60, 'Customer name cannot exceed 60 characters']
    },
    note: {
      type: String,
      required: [true, 'Service reason is required'],
      trim: true,
      maxlength: [120, 'Note cannot exceed 120 characters']
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
