import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

// Frontend-এর সঙ্গে connection
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

// Better Auth route
app.all("/api/auth/{*any}", toNodeHandler(auth));

// Stripe Webhook - Raw Body Required
app.use("/payments/webhook", express.raw({ type: "application/json" }));

// JSON data
app.use(express.json());

app.use("/payments", paymentRoutes);

// admin all Service routes
app.use("/profile", profileRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/services", serviceRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/users", userRoutes);

app.get("/", (req, res) => {
  res.send("SalonHub Server is Running!");
});

export default app;
