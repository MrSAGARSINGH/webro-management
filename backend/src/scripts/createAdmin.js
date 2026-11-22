
import "dotenv/config";
import mongoose from "mongoose";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import User from "../models/User.js";

const normalizeEmail = (value) =>
  value.trim().toLowerCase();

const validatePassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= 12 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is missing from the .env file"
    );
  }

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  let name;
  let email;
  let password;

  try {
    name = (await rl.question("Admin name: ")).trim();

    email = normalizeEmail(
      await rl.question("Admin email: ")
    );

    password = await rl.question(
      "Admin password (min 12 characters): "
    );
  } finally {
    rl.close();
  }

  if (name.length < 2 || name.length > 100) {
    throw new Error(
      "Admin name must contain 2 to 100 characters"
    );
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Invalid admin email");
  }

  if (!validatePassword(password)) {
    throw new Error(
      "Password must contain at least 12 characters and at most 72 UTF-8 bytes"
    );
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  // Prevent accidental creation of another bootstrap admin.
  const existingAdmin = await User.exists({
    role: "admin",
  });

  if (existingAdmin) {
    throw new Error(
      "An admin account already exists. Bootstrap is disabled"
    );
  }

  const existingEmail = await User.exists({
    email,
  });

  if (existingEmail) {
    throw new Error(
      "An account with this email already exists"
    );
  }

  const admin = new User({
    name,
    email,
    role: "admin",
    isActive: true,
  });

  await admin.setPassword(password);
  await admin.save();

  console.log("\nAdmin account created successfully");
  console.log(`Name: ${admin.name}`);
  console.log(`Email: ${admin.email}`);
  console.log(`Role: ${admin.role}`);
};

main()
  .catch((error) => {
    console.error("Admin bootstrap failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
