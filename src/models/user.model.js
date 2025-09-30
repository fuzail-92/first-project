// Mongoose aur required libraries import kar rahe hain
import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"; // JWT tokens generate karne ke liye
import bcrypt from "bcrypt"; // Passwords hash karne ke liye

// User ka schema define kar rahe hain
const userSchema = new Schema(
  {
    // Unique username (lowercase, trimmed)
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true, // Indexing for faster queries
    },
    // Unique email (lowercase, trimmed)
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // User ka full name
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Profile picture (Cloudinary ya kisi image URL ke liye)
    avatar: {
      type: String,
      required: true,
    },
    // Optional cover image URL
    coverImage: {
      type: String,
    },
    // Watch history: videos ka reference list
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "video", // 'video' model ke documents ke references
      },
    ],
    // Hashed password
    password: {
      type: String,
      required: [true, "Password  is required"],
    },
    // Refresh token (JWT) store karne ke liye
    refreshToken: {
      type: String,
    },
    // Ye field yahan zarurat ke bagair hai, remove ki ja sakti hai
    id: {},
  },
  {
    // timestamps: createdAt aur updatedAt fields automatically add karega
    timestamps: true,
  }
);

// ✅ Pre-save hook: Save se pehle password hash kar rahe hain
userSchema.pre("save", async function (next) {
  // Agar password modify nahi hua to next middleware pe chale jao
  if (!this.isModified("password")) return next();

  // Password ko bcrypt se hash karo (10 salt rounds)
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ✅ Method to compare entered password with hashed password
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// ✅ Method to generate JWT Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET, // Secret key from env
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY, // e.g., "15m"
    }
  );
};

// ✅ Method to generate JWT Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET, // Secret key from env
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY, // e.g., "7d"
    }
  );
};

// ✅ Model export kar rahe hain
export const User = mongoose.model("User", userSchema);
