import Stripe from "stripe";
import "dotenv/config";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing from environment variables.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default stripe;
