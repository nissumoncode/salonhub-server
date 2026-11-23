import express from "express";
import { ObjectId } from "mongodb";
import { getServicesCollection } from "../config/db.js";
import { requireJWT, requireAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Get all active services (Public)
router.get("/", async (req, res) => {
  try {
    const servicesCollection = await getServicesCollection();

    const services = await servicesCollection
      .find({ status: "active" })
      .toArray();

    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get services",
    });
  }
});

// Get all services including inactive (Admin only)
router.get("/admin/all", requireJWT, requireAdmin, async (req, res) => {
  try {
    const servicesCollection = await getServicesCollection();

    const services = await servicesCollection.find({}).toArray();

    res.status(200).json(services);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get all services",
    });
  }
});

// Get single active service by ID (Public)
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
      status: "active",
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

// Add service
router.post("/", requireJWT, requireAdmin, async (req, res) => {
  try {
    const {
      serviceName,
      category,
      description,
      price,
      duration,
      image = "",
      status = "active",
    } = req.body || {};

    // Validate required text fields
    if (
      typeof serviceName !== "string" ||
      !serviceName.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({
        message: "Service name, category, and description are required.",
      });
    }

    // Validate price
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Price must be a positive number.",
      });
    }

    // Validate duration
    if (
      typeof duration !== "number" ||
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      return res.status(400).json({
        message: "Duration must be a positive integer.",
      });
    }

    // Validate image
    if (typeof image !== "string") {
      return res.status(400).json({
        message: "Image must be a valid string.",
      });
    }

    // Validate status
    if (status !== "active" && status !== "inactive") {
      return res.status(400).json({
        message: "Status must be active or inactive.",
      });
    }

    const newService = {
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price,
      duration,
      image,
      status,
    };

    const servicesCollection = await getServicesCollection();

    const result = await servicesCollection.insertOne(newService);

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
