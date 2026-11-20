import express from "express";
import { ObjectId } from "mongodb";
import { requireJWT, requireAdmin } from "../middleware/authMiddleware.js";
import { getUsersCollection } from "../config/db.js";

const router = express.Router();

// Get all customers
router.get("/", requireJWT, requireAdmin, async (req, res) => {
  try {
    const usersCollection = await getUsersCollection();

    const customers = await usersCollection
      .find(
        { role: "customer" },
        {
          projection: {
            name: 1,
            email: 1,
            isBlocked: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(customers);
  } catch (error) {
    console.error("Get customers error:", error);

    res.status(500).json({
      message: "Failed to get customers.",
    });
  }
});

// Block or unblock customer
router.patch("/:id/block", requireJWT, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid customer ID.",
      });
    }

    if (typeof isBlocked !== "boolean") {
      return res.status(400).json({
        message: "isBlocked must be true or false.",
      });
    }

    const usersCollection = await getUsersCollection();

    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(id),
        role: "customer",
      },
      {
        $set: { isBlocked },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    res.status(200).json({
      message: isBlocked
        ? "Customer blocked successfully."
        : "Customer unblocked successfully.",
    });
  } catch (error) {
    console.error("Update customer block status error:", error);

    res.status(500).json({
      message: "Failed to update customer status.",
    });
  }
});

export default router;
