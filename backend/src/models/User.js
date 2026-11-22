
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address",
      ],
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "employee"],
      default: "employee",
      required: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      match: [
        /^$|^[6-9]\d{9}$/,
        "Enter a valid Indian mobile number",
      ],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Prevent duplicate email accounts
userSchema.index({ email: 1 }, { unique: true });

// Remove sensitive fields from JSON responses
userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

// Hash passwords explicitly before saving
userSchema.methods.setPassword = async function (
  plainPassword
) {
  if (
    typeof plainPassword !== "string" ||
    plainPassword.length < 12 ||
    Buffer.byteLength(plainPassword, "utf8") > 72
  ) {
    throw new Error(
      "Password must be at least 12 characters and at most 72 UTF-8 bytes"
    );
  }

  this.passwordHash = await bcrypt.hash(
    plainPassword,
    12
  );

  this.passwordChangedAt = new Date();
};

// Compare login password
userSchema.methods.comparePassword = async function (
  plainPassword
) {
  if (
    typeof plainPassword !== "string" ||
    !this.passwordHash
  ) {
    return false;
  }

  return bcrypt.compare(
    plainPassword,
    this.passwordHash
  );
};

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

export default User;

