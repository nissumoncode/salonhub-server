import { MongoClient } from "mongodb";
import "dotenv/config";

const client = new MongoClient(process.env.MONGODB_URI);

let db;

export const connectDB = async () => {
  try {
    if (db) return db;

    await client.connect();

    db = client.db("salonhub");

    console.log("MongoDB Connected Successfully!");

    return db;
  } catch (error) {
    console.log("MongoDB Connection Failed:", error);
    process.exit(1);
  }
};

export const getMongoClient = () => client;

// Services collection
export const getServicesCollection = async () => {
  const database = await connectDB();
  return database.collection("services");
};
// Users collection
export const getUsersCollection = async () => {
  const database = await connectDB();
  return database.collection("user");
};
// Appointments collection
export const getAppointmentsCollection = async () => {
  const database = await connectDB();
  return database.collection("appointments");
};
