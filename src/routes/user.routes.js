import { Router } from "express";
import {
  LoginUser,
  logOutUser,
  registerUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
} from "../controllers/user.controller.js";

import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// User registration with avatar and coverImage upload
router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

// User login
router.route("/login").post(LoginUser);

// Secure routes that require JWT verification

// User logout
router.route("/logout").post(verifyJWT, logOutUser);

// Refresh access token (no JWT verification because this refreshes token)
router.route("/refresh-token").post(refreshAccessToken);

// Change user password
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

// Get current logged-in user info
router.route("/current-user").get(verifyJWT, getCurrentUser);

// Update user account details
router.route("/update-account").patch(verifyJWT, updateAccountDetails);

// Update user avatar image
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

// Update user cover image
router
  .route("/cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

// Get user channel profile by username
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);

// Get user watch history
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
