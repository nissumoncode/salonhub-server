import express from "express";
import { ObjectId } from "mongodb";
import { requireJWT } from "../middleware/authMiddleware.js";
import { getUsersCollection } from "../config/db.js";

const router = express.Router();

// Get own profile
router.get("/me", requireJWT, async (req, res) => {
  try {
    const usersCollection = await getUsersCollection();

    const user = await usersCollection.findOne(
      { _id: new ObjectId(req.user.id) },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          phoneNumber: 1,
          role: 1,
        },
      },
    );

    if (!user) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      message: "Failed to get profile.",
    });
  }
});

// Update own profile
router.patch("/me", requireJWT, async (req, res) => {
  try {
    const { name, image, phoneNumber } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Name is required.",
        });
      }

      updates.name = name.trim();
    }

    if (image !== undefined) {
      if (typeof image !== "string") {
        return res.status(400).json({
          message: "Invalid profile image.",
        });
      }

      updates.image = image.trim();
    }

    if (phoneNumber !== undefined) {
      if (typeof phoneNumber !== "string") {
        return res.status(400).json({
          message: "Invalid phone number.",
        });
      }

      updates.phoneNumber = phoneNumber.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid profile information provided.",
      });
    }

    updates.updatedAt = new Date();

    const usersCollection = await getUsersCollection();

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: updates },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(req.user.id) },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          phoneNumber: 1,
          role: 1,
        },
      },
    );

    res.status(200).json({
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      message: "Failed to update profile.",
    });
  }
});

export default router;
