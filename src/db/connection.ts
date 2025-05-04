import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let db: Db | null = null;
let client: MongoClient | null = null;

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/chapters";

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log("MongoDB connection established successfully");

    db = client.db();
    return db;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    console.log("MongoDB connection closed gracefully");
  }
}

// Handle application shutdown
process.on("SIGINT", async () => {
  await closeDatabaseConnection();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDatabaseConnection();
  process.exit(0);
});
