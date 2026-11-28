
import "../config/dns.js";
import "dotenv/config";
import mongoose from "mongoose";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import User from "../models/User.js";

// ======================================
// Reset Admin Credentials
// ======================================

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  // ======================================
  // Connect MongoDB
  // ======================================

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("\nDatabase connected");
  console.log(`Database: ${mongoose.connection.name}`);

  // ======================================
  // Find Existing Admin Accounts
  // ======================================

  const admins = await User.find({
    role: "admin",
  }).select("name email isActive");

  if (admins.length === 0) {
    throw new Error(
      "No admin found. Run npm run create-admin first."
    );
  }

  console.log("\nExisting Admin Accounts:");

  admins.forEach((admin) => {
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Active: ${admin.isActive}`);
    console.log("------------------------------");
  });

  // ======================================
  // Terminal Interface
  // ======================================

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    // ======================================
    // Existing Admin Email
    // ======================================

    const oldEmail = (
      await rl.question("Existing admin email: ")
    )
      .trim()
      .toLowerCase();

    const admin = await User.findOne({
      email: oldEmail,
      role: "admin",
    }).select("+passwordHash");

    if (!admin) {
      throw new Error("Admin account not found");
    }

    // ======================================
    // New Admin Email
    // ======================================

    const emailInput = (
      await rl.question(
        "New admin email (press Enter to keep existing): "
      )
    )
      .trim()
      .toLowerCase();

    const newEmail = emailInput || admin.email;

    if (
      newEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)
    ) {
      throw new Error("Invalid email address");
    }

    // ======================================
    // Check Duplicate Email
    // ======================================

    const existingUser = await User.exists({
      email: newEmail,
      _id: { $ne: admin._id },
    });

    if (existingUser) {
      throw new Error("Email is already in use");
    }

    // ======================================
    // New Password
    // ======================================

    const newPassword = (
      await rl.question(
        "New password (min 12 characters): "
      )
    ).trim();

    if (newPassword.length < 12) {
      throw new Error(
        "Password must contain at least 12 characters"
      );
    }

    if (Buffer.byteLength(newPassword, "utf8") > 72) {
      throw new Error(
        "Password must not exceed 72 UTF-8 bytes"
      );
    }

    // ======================================
    // Confirm Password
    // ======================================

    const confirmPassword = (
      await rl.question("Confirm new password: ")
    ).trim();

    if (newPassword !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    // ======================================
    // Confirm Reset
    // ======================================

    console.log("\nAccount to update:");
    console.log(`Name: ${admin.name}`);
    console.log(`Current email: ${admin.email}`);
    console.log(`New email: ${newEmail}`);
    console.log(`Role: ${admin.role}`);

    const confirmation = (
      await rl.question("\nType RESET to confirm: ")
    )
      .trim()
      .toUpperCase();

    if (confirmation !== "RESET") {
      console.log("\nOperation cancelled");
      return;
    }

    // ======================================
    // Update Admin Credentials
    // ======================================

    admin.email = newEmail;

    await admin.setPassword(newPassword);

    await admin.save();

    // ======================================
    // Success Response
    // ======================================

    console.log("\n================================");
    console.log("ADMIN UPDATED SUCCESSFULLY");
    console.log("================================");
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Active: ${admin.isActive}`);
    console.log("Password: Updated securely");
    console.log(`Database: ${mongoose.connection.name}`);
    console.log("================================");

    console.log(
      "\nLogin URL: https://webro-management.vercel.app/"
    );
  } finally {
    rl.close();
  }
};

// ======================================
// Execute Script
// ======================================

main()
  .catch((error) => {
    console.error(
      "\nAdmin reset failed:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("\nMongoDB connection closed");
  });
