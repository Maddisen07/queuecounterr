import mongoose from 'mongoose';

const sequenceSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    seq: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export const Sequence = mongoose.model('Sequence', sequenceSchema);
