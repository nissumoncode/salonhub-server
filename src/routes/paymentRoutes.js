import express from "express";
import { ObjectId } from "mongodb";

import stripe from "../config/stripe.js";
import { requireJWT } from "../middleware/authMiddleware.js";
import { getAppointmentsCollection } from "../config/db.js";
import { getTransactionsCollection } from "../config/db.js";

const router = express.Router();

// Customer creates Stripe Checkout Session
router.post("/create-checkout-session", requireJWT, async (req, res) => {
  try {
    // Only customers can make payments
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can make payments.",
      });
    }

    const { appointmentId } = req.body;

    // Validate appointment ID
    if (!appointmentId || !ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        message: "Invalid appointment ID.",
      });
    }

    const appointmentsCollection = await getAppointmentsCollection();

    // Find appointment belonging to this customer
    const appointment = await appointmentsCollection.findOne({
      _id: new ObjectId(appointmentId),
      customerId: new ObjectId(req.user.id),
    });

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found.",
      });
    }

    // Only confirmed appointments can be paid
    if (appointment.status !== "Confirmed") {
      return res.status(400).json({
        message: "Only confirmed appointments can be paid.",
      });
    }

    // Prevent duplicate payments
    if (appointment.paymentStatus !== "Unpaid") {
      return res.status(400).json({
        message: "This appointment has already been paid.",
      });
    }

    // Validate database price
    const price = Number(appointment.price);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Invalid appointment price.",
      });
    }

    // Convert USD to cents
    const amountInCents = Math.round(price * 100);

    // Reuse an existing open Checkout Session
    if (appointment.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        appointment.stripeCheckoutSessionId,
      );

      if (existingSession.status === "open") {
        return res.status(200).json({
          url: existingSession.url,
        });
      }

      if (
        existingSession.status === "complete" &&
        existingSession.payment_status !== "paid"
      ) {
        return res.status(409).json({
          message: "Payment is processing. Please wait for confirmation.",
        });
      }
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: appointment.serviceName,
              description: `Appointment: ${appointment.date} at ${appointment.timeSlot}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],

      customer_email: appointment.customerEmail || undefined,

      client_reference_id: appointment._id.toString(),

      metadata: {
        appointmentId: appointment._id.toString(),
        customerId: req.user.id,
      },

      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${clientUrl}/payment/cancel`,
    });

    // Save Checkout Session ID in appointment
    await appointmentsCollection.updateOne(
      {
        _id: appointment._id,
        customerId: new ObjectId(req.user.id),
        status: "Confirmed",
        paymentStatus: "Unpaid",
      },
      {
        $set: {
          stripeCheckoutSessionId: session.id,
          updatedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      message: "Stripe Checkout Session created successfully.",
      url: session.url,
    });
  } catch (error) {
    console.error("Create Checkout Session Error:", error);

    return res.status(500).json({
      message: "Failed to create payment session.",
    });
  }
});

// Check payment status for Payment Success page
router.get("/verify-session", requireJWT, async (req, res) => {
  try {
    //bad
    console.log("VERIFY ROLE:", req.user.role);

    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can verify their payments.",
      });
    }

    const sessionId = req.query.session_id;

    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        message: "Invalid Checkout Session ID.",
      });
    }

    const appointmentsCollection = await getAppointmentsCollection();

    const appointment = await appointmentsCollection.findOne({
      customerId: new ObjectId(req.user.id),
      stripeCheckoutSessionId: sessionId,
    });

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found.",
      });
    }

    return res.status(200).json({
      paymentStatus: appointment.paymentStatus,
      appointmentStatus: appointment.status,
      serviceName: appointment.serviceName,
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);

    return res.status(500).json({
      message: "Failed to verify payment.",
    });
  }
});

// Admin gets all payment transactions
router.get("/transactions", requireJWT, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can view transactions.",
      });
    }

    const transactionsCollection = await getTransactionsCollection();

    const transactions = await transactionsCollection
      .find({})
      .sort({ transactionDate: -1 })
      .toArray();

    return res.status(200).json(transactions);
  } catch (error) {
    console.error("Get Transactions Error:", error);

    return res.status(500).json({
      message: "Failed to load transactions.",
    });
  }
});

// Stripe Webhook - Verify successful payment
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({
        message: "Stripe signature is missing.",
      });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("STRIPE_WEBHOOK_SECRET is missing.");
      return res.status(500).json({
        message: "Webhook configuration is missing.",
      });
    }

    // Verify Stripe webhook signature
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      console.error("Webhook Signature Error:", error.message);

      return res.status(400).json({
        message: "Invalid Stripe webhook signature.",
      });
    }

    // Handle successful Checkout payment
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Payment must actually be successful
      if (session.payment_status !== "paid") {
        return res.status(200).json({
          received: true,
          message: "Payment is not completed yet.",
        });
      }

      const { appointmentId, customerId } = session.metadata || {};

      if (
        !appointmentId ||
        !customerId ||
        !ObjectId.isValid(appointmentId) ||
        !ObjectId.isValid(customerId)
      ) {
        console.error("Invalid appointment or customer metadata.");

        return res.status(400).json({
          message: "Invalid payment metadata.",
        });
      }

      const appointmentsCollection = await getAppointmentsCollection();
      const transactionsCollection = await getTransactionsCollection();

      // Find the exact appointment and Checkout Session
      const appointment = await appointmentsCollection.findOne({
        _id: new ObjectId(appointmentId),
        customerId: new ObjectId(customerId),
        stripeCheckoutSessionId: session.id,
      });

      if (!appointment) {
        console.error("Matching appointment not found.");

        return res.status(404).json({
          message: "Appointment not found.",
        });
      }

      // Verify appointment status
      if (
        appointment.status !== "Confirmed" ||
        !["Unpaid", "Paid"].includes(appointment.paymentStatus)
      ) {
        return res.status(400).json({
          message: "Appointment is not eligible for payment.",
        });
      }

      // Verify amount and currency against database price
      const expectedAmount = Math.round(Number(appointment.price) * 100);

      if (
        !Number.isFinite(expectedAmount) ||
        expectedAmount <= 0 ||
        session.amount_total !== expectedAmount ||
        session.currency !== "usd"
      ) {
        console.error("Payment amount or currency mismatch.");

        return res.status(400).json({
          message: "Payment verification failed.",
        });
      }

      // Check whether this transaction was already saved
      const existingTransaction = await transactionsCollection.findOne({
        stripeSessionId: session.id,
      });

      if (!existingTransaction) {
        await transactionsCollection.insertOne({
          stripeSessionId: session.id,
          appointmentId: appointment._id,
          customerId: appointment.customerId,
          customerName: appointment.customerName,
          customerEmail: appointment.customerEmail,
          serviceName: appointment.serviceName,
          appointmentDate: appointment.date,
          amount: session.amount_total / 100,
          currency: session.currency.toUpperCase(),
          paymentStatus: "Paid",
          transactionDate: new Date(session.created * 1000),
          createdAt: new Date(),
        });
      }

      // Update appointment only after verified payment
      if (appointment.paymentStatus !== "Paid") {
        const updateResult = await appointmentsCollection.updateOne(
          {
            _id: appointment._id,
            customerId: appointment.customerId,
            stripeCheckoutSessionId: session.id,
            status: "Confirmed",
            paymentStatus: "Unpaid",
          },
          {
            $set: {
              paymentStatus: "Paid",
              updatedAt: new Date(),
            },
          },
        );

        if (updateResult.modifiedCount !== 1) {
          return res.status(409).json({
            message: "Appointment payment status could not be updated.",
          });
        }
      }
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe Webhook Error:", error);

    return res.status(500).json({
      message: "Webhook processing failed.",
    });
  }
});

export default router;
