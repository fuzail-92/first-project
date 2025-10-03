import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh token and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // user details req.body se nikaal rahe hain
  const { fullName, email, username, password } = req.body;
  // console.log("email: ", email);

  // empty field check kar rahe hain
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // database se existing user check kar rahe hain
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  // agar user already exist karta ho to error throw karte hain
  if (existedUser) {
    throw new ApiError(409, "User with email or user name already exists");
  }
  // console.log(req.files);
  // 1. Files ka path lena
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path; // ✅ ye sahi hai
  }

  // 2. Validation - avatar file required hai
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 3. Upload files on Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 4. Create user in DB
  const createdUserData = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // 5. Remove password and refreshToken from response
  const createdUser = await User.findById(createdUserData._id).select(
    "-password -refreshToken"
  );

  // 6. Check if user was created successfully
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // 7. Return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});
const LoginUser = asyncHandler(async (req, res) => {
  // req body -> data
  const { email, username, password } = req.body;

  // username or email
  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }
  // find the user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  // password user
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "invalid user credential");
  }
  // access and refresh token

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully"
      )
    );
});
//logout

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options) // ✅ fixed
    .clearCookie("refreshToken", options) // ✅ fixed
    .json(new ApiResponse(200, {}, "User logged Out"));
});

// Controller to handle refreshing access token using refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
  // 1. Retrieve refresh token from cookie or request body
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // 2. If no refresh token is provided, reject the request
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request: Refresh token missing");
  }

  // 3. Verify the refresh token using JWT
  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  // 4. Find the user based on the token's decoded user ID
  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  // 5. Ensure the token matches the one stored in the database
  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or reused");
  }

  // 6. Define secure cookie options
  const options = {
    httpOnly: true,
    secure: true, // Use HTTPS in production
  };

  // 7. Generate new access and refresh tokens
  const { accessToken, refreshToken: newRefreshToken } =
    await generateAccessAndRefereshTokens(user._id);

  // 8. Send new tokens in cookies and response body
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access Token refreshed"
      )
    );
});

// Change current user's password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Find the user by ID
  const user = await User.findById(req.user?._id);

  // Check if the old password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  // Set the new password and save user
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Get current logged-in user details
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

// Update full name and email of the user
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  // Check if both fields are provided
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Update the user's fullName and email
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// Update user avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
  // Get the local path of the uploaded avatar file from the request
  const avatarLocalPath = req.file?.path;

  // If no file was uploaded, throw an error
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  // Upload the avatar to Cloudinary and get the result
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // If uploading failed (no URL returned), throw an error
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  // Update the user's avatar URL in the database, excluding the password field in the result
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

// Update user cover image
const updateUserCoverImage = asyncHandler(async (req, res) => {
  // Get the local path of the uploaded cover image file from the request
  const coverImageLocalPath = req.file?.path;

  // If no file was uploaded, throw an error
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  // Upload the cover image to Cloudinary and get the result
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // If uploading failed (no URL returned), throw an error
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  // Update the user's cover image URL in the database, excluding the password field in the result
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  // 🔍 Validate that username is provided and not empty
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  // 📊 Aggregation pipeline to fetch user channel profile
  const channel = await User.aggregate([
    // Step 1: Match the user by username (case-insensitive)
    {
      $match: {
        username: username.toLowerCase(),
      },
    },

    // Step 2: Lookup subscribers - users who subscribed to this user
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },

    // Step 3: Lookup channels this user has subscribed to
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },

    // Step 4: Add calculated fields
    {
      $addFields: {
        // Total number of subscribers
        subscribersCount: {
          $size: "$subscribers",
        },

        // Total number of channels this user has subscribed to
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },

        // Check if the current logged-in user is subscribed to this channel
        isSubscribed: {
          $cond: {
            if: {
              $in: [
                req.user?._id, // Current logged-in user's ID
                {
                  // Extract all subscriber IDs from subscribers array
                  $map: {
                    input: "$subscribers",
                    as: "s",
                    in: "$$s.subscriber",
                  },
                },
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },

    // Step 5: Project only required fields in the final output
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  // ❌ If no user/channel found with given username
  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exists");
  }

  // ✅ Return the channel data in a consistent API response format
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched successfuly"));
});

export {
  registerUser,
  LoginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
};
