// ye chke kre ga k middleware hai k nahi

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// ye middleware JWT token verify kare ga
export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // token cookies ya headers se uthaya ja raha hai
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    // agar token nahi mila to unauthorized error
    if (!token) {
      throw new ApiError(401, "Unathorized request");
    }

    // token verify karna
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // database se user nikalna, password aur refreshToken exclude karke
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    // agar user nahi mila to invalid token error
    if (!user) {
      // next disussed about frontend
      throw new ApiError(401, "Invalid Access Token");
    }

    // req.user me user attach karna
    req.user = user;

    // next middleware ko call karna
    next();
  } catch (error) {
    // agar error aya to unauthorized error
    throw new ApiError(401, error?.message || "invalid access token");
  }
});
