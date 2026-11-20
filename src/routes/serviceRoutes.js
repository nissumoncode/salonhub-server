import express from "express";
import { ObjectId } from "mongodb";
import { getServicesCollection } from "../config/db.js";
import { requireJWT, requireAdmin } from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Get all services
router.get("/", async (req, res) => {
  try {
    const servicesCollection = await getServicesCollection();

    const services = await servicesCollection.find({}).toArray();

    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get services",
    });
  }
});

// Get single service by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    const servicesCollection = await getServicesCollection();

    const service = await servicesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get service",
    });
  }
});

// add sarvice
router.post("/", requireJWT, requireAdmin, async (req, res) => {
  try {
    const servicesCollection = await getServicesCollection();

    const result = await servicesCollection.insertOne(req.body);

    res.status(201).json({
      message: "Service created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create service",
    });
  }
});

// Update service
router.put("/:id", requireJWT, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      serviceName,
      category,
      description,
      price,
      duration,
      image,
      status,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    if (
      typeof price !== "number" ||
      price <= 0 ||
      typeof duration !== "number" ||
      duration <= 0
    ) {
      return res.status(400).json({
        message: "Price and duration must be positive numbers.",
      });
    }

    const servicesCollection = await getServicesCollection();

    const result = await servicesCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          serviceName,
          category,
          description,
          price,
          duration,
          image,
          status,
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found.",
      });
    }

    res.status(200).json({
      message: "Service updated successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update service.",
    });
  }
});

// Delete service
router.delete("/:id", requireJWT, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid service ID",
      });
    }

    const servicesCollection = await getServicesCollection();

    const result = await servicesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Service not found.",
      });
    }

    res.status(200).json({
      message: "Service deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete service.",
    });
  }
});

// Upload service image to ImgBB
router.post(
  "/upload-image",
  requireJWT,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select an image.",
        });
      }

      const formData = new FormData();

      const imageBlob = new Blob([req.file.buffer], {
        type: req.file.mimetype,
      });

      formData.append("image", imageBlob, req.file.originalname);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        return res.status(500).json({
          message: "Image upload to ImgBB failed.",
        });
      }

      res.status(200).json({
        message: "Image uploaded successfully.",
        imageUrl: data.data.url,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to upload image.",
      });
    }
  },
);

export default router;
