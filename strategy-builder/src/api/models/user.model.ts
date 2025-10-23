/**
 * User Model
 * MongoDB schema for user accounts
 */

import mongoose, { Schema } from 'mongoose';
import { IUser, UserRole } from '../../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../../middleware/rbac';

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.TRADER,
      required: true
    },
    permissions: {
      type: [String],
      default: function(this: IUser) {
        return DEFAULT_ROLE_PERMISSIONS[this.role] || [];
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Virtual for user ID string
userSchema.virtual('id').get(function(this: IUser) {
  return this._id.toString();
});

// Transform JSON output
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
