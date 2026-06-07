import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

// Helper to extract or sanitize database URL.
// If the DB_URL ends with /, we default to connecting to the 'postgres' database.
let dbUrl = process.env.DB_URL || "postgresql://postgres:password@localhost:5432/";
if (dbUrl.endsWith("/")) {
  dbUrl += "postgres";
}

export const pool = new Pool({
  connectionString: dbUrl,
});

export const db = drizzle(pool, { schema });
