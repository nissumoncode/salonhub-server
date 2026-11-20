import express from "express";
import { ObjectId } from "mongodb";

import { requireJWT, requireAdmin } from "../middleware/authMiddleware.js";

import {
  getAppointmentsCollection,
  getServicesCollection,
} from "../config/db.js";

const router = express.Router();

// Customer gets their own appointments
router.get("/my", requireJWT, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can view their appointments.",
      });
    }

    const appointmentsCollection = await getAppointmentsCollection();

    const appointments = await appointmentsCollection
      .find({
        customerId: new ObjectId(req.user.id),
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Get my appointments error:", error);

    res.status(500).json({
      message: "Failed to get appointments.",
    });
  }
});

// Admin gets all appointments
router.get("/", requireJWT, requireAdmin, async (req, res) => {
  try {
    const appointmentsCollection = await getAppointmentsCollection();

    const appointments = await appointmentsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Get all appointments error:", error);

    res.status(500).json({
      message: "Failed to get appointments.",
    });
  }
});

// Admin updates appointment status
router.patch("/:id/status", requireJWT, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid appointment ID.",
      });
    }

    if (!["Confirmed", "Cancelled"].includes(status)) {
      return res.status(400).json({
        message: "Invalid appointment status.",
      });
    }

    const appointmentsCollection = await getAppointmentsCollection();

    const allowedStatuses =
      status === "Confirmed" ? ["Pending"] : ["Pending", "Confirmed"];

    const result = await appointmentsCollection.updateOne(
      {
        _id: new ObjectId(id),
        status: { $in: allowedStatuses },
      },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Appointment not found or status cannot be updated.",
      });
    }

    res.status(200).json({
      message: `Appointment ${status.toLowerCase()} successfully.`,
    });
  } catch (error) {
    console.error("Update appointment status error:", error);

    res.status(500).json({
      message: "Failed to update appointment status.",
    });
  }
});

// Customer creates appointment
router.post("/", requireJWT, async (req, res) => {
  try {
    // Only customers can book
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can book appointments.",
      });
    }

    const { serviceId, date, timeSlot, message } = req.body;

    if (!serviceId || !date || !timeSlot) {
      return res.status(400).json({
        message: "Service, date and time slot are required.",
      });
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    // Check service
    const servicesCollection = await getServicesCollection();

    const service = await servicesCollection.findOne({
      _id: new ObjectId(serviceId),
      status: "active",
    });

    if (!service) {
      return res.status(404).json({
        message: "Active service not found.",
      });
    }

    const appointmentsCollection = await getAppointmentsCollection();

    // Prevent duplicate active booking
    const existingAppointment = await appointmentsCollection.findOne({
      date,
      timeSlot,
      status: { $in: ["Pending", "Confirmed"] },
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: "This time slot is already booked.",
      });
    }

    const appointment = {
      serviceId: new ObjectId(serviceId),
      serviceName: service.serviceName,
      category: service.category,
      image: service.image,
      price: service.price,
      duration: service.duration,
      customerId: new ObjectId(req.user.id),
      customerName: req.user.name || "",
      customerEmail: req.user.email || "",
      date,
      timeSlot,
      message: message || "",
      status: "Pending",
      paymentStatus: "Unpaid",
      createdAt: new Date(),
    };

    const result = await appointmentsCollection.insertOne(appointment);

    res.status(201).json({
      message: "Appointment request submitted successfully.",
      appointmentId: result.insertedId,
    });
  } catch (error) {
    console.error("Create appointment error:", error);

    res.status(500).json({
      message: "Failed to create appointment.",
    });
  }
});

// Customer cancels their own pending appointment
router.patch("/:id/cancel", requireJWT, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can cancel appointments.",
      });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid appointment ID.",
      });
    }

    const appointmentsCollection = await getAppointmentsCollection();

    const result = await appointmentsCollection.updateOne(
      {
        _id: new ObjectId(id),
        customerId: new ObjectId(req.user.id),
        status: "Pending",
      },
      {
        $set: { status: "Cancelled" },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Appointment not found or cannot be cancelled.",
      });
    }

    res.status(200).json({
      message: "Appointment cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);

    res.status(500).json({
      message: "Failed to cancel appointment.",
    });
  }
});

export default router;
