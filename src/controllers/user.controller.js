import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { user } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // user details req.body se nikaal rahe hain
  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  // empty field check kar rahe hain
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // database se existing user check kar rahe hain
  const existedUser = await user.findOne({
    $or: [{ username }, { email }],
  });

  // agar user already exist karta ho to error throw karte hain
  if (existedUser) {
    throw new ApiError(409, "User with email or user name already exists");
  }

  // 1. Files ka path lena
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

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
  const createdUserData = await user.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // 5. Remove password and refreshToken from response
  const createdUser = await user
    .findById(createdUserData._id)
    .select("-password -refreshToken");

  // 6. Check if user was created successfully
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // 7. Return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };
