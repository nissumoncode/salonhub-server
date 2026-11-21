import express from "express";
import { requireJWT, requireAdmin } from "../middleware/authMiddleware.js";
import {
  getUsersCollection,
  getServicesCollection,
  getAppointmentsCollection,
  getTransactionsCollection,
} from "../config/db.js";

const router = express.Router();

// Admin dashboard statistics
router.get("/stats", requireJWT, requireAdmin, async (req, res) => {
  try {
    const usersCollection = await getUsersCollection();
    const servicesCollection = await getServicesCollection();
    const appointmentsCollection = await getAppointmentsCollection();
    const transactionsCollection = await getTransactionsCollection();

    const [
      totalCustomers,
      activeServices,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      successfulPayments,
      pendingPayments,
    ] = await Promise.all([
      usersCollection.countDocuments({ role: "customer" }),
      servicesCollection.countDocuments({ status: "active" }),
      appointmentsCollection.countDocuments({}),
      appointmentsCollection.countDocuments({ status: "Pending" }),
      appointmentsCollection.countDocuments({ status: "Confirmed" }),
      transactionsCollection.countDocuments({ paymentStatus: "Paid" }),
      appointmentsCollection.countDocuments({ paymentStatus: "Unpaid" }),
    ]);

    res.status(200).json({
      totalCustomers,
      activeServices,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      successfulPayments,
      pendingPayments,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    res.status(500).json({
      message: "Failed to load dashboard statistics.",
    });
  }
});

export default router;
