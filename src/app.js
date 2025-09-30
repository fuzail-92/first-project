import express from "express"; // Express framework import
import cors from "cors"; // CORS middleware import
import CookieParser from "cookie-parser"; // Cookie parsing middleware import

const app = express(); // Express app initialize

// 🌐 CORS setup
// Ye allow karega front-end app ko specific origin se requests bhejne ki permission
// credentials: true -> cookies send karne ke liye
app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // allowed origin from env variable
    credentials: true,
  })
);

// 📦 Body parsing middleware
// JSON data ko parse karne ke liye
app.use(express.json({ limit: "16kb" })); // max request body size 16kb

// URL-encoded form data parse karne ke liye
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// 📁 Static files serve karna
// public folder ke files (images, css, js) ko direct access dena
app.use(express.static("public"));

// 🍪 Cookie parsing middleware
// Request me cookies ko easily access karne ke liye
app.use(CookieParser());

// ========================
// Routes import
// ========================
import userRouter from "./routes/user.routes.js";

// ========================
// Routes declaration
// ========================
// All user-related routes ka prefix: /api/v1/users
// Example: register endpoint -> http://localhost:8000/api/v1/users/register
app.use("/api/v1/users", userRouter);

// 🔗 App export karna
// Ye file directly server start ke liye nahi hai, sirf app ko export kar raha hai
export { app };
