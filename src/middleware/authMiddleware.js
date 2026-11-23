import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../config/db.js";
import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseURL = process.env.BETTER_AUTH_URL;

const JWKS = createRemoteJWKSet(new URL(`${authBaseURL}/api/auth/jwks`));

// JWT Token Verification

export const requireJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "JWT Token is required.",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authBaseURL,
      audience: authBaseURL,
      algorithms: ["EdDSA"],
    });

    if (!payload.sub || !ObjectId.isValid(payload.sub)) {
      return res.status(401).json({
        message: "Invalid User ID.",
      });
    }

    const usersCollection = await getUsersCollection();

    const currentUser = await usersCollection.findOne({
      _id: new ObjectId(payload.sub),
    });

    if (!currentUser) {
      return res.status(401).json({
        message: "User not found.",
      });
    }

    if (currentUser.isBlocked) {
      return res.status(403).json({
        message: "Your account has been blocked.",
      });
    }

    req.user = {
      ...payload,
      id: payload.sub,
      name: currentUser.name || "",
      email: currentUser.email || "",
      role: currentUser.role,
      isBlocked: currentUser.isBlocked,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired JWT Token.",
    });
  }
};

// Login & Blocked User check
export const requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({
        message: "Unauthorized. Please sign in.",
      });
    }

    if (session.user.isBlocked) {
      return res.status(403).json({
        message: "Your account has been blocked.",
      });
    }

    req.user = session.user;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Authentication failed.",
    });
  }
};

// only Admin Access
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Admin only.",
    });
  }

  next();
};
