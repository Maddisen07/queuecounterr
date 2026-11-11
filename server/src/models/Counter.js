import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Counter name is required'],
      unique: true,
      trim: true,
      maxlength: [40, 'Counter name cannot exceed 40 characters']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    currentToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Token',
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const Counter = mongoose.model('Counter', counterSchema);
