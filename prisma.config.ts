import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Falls back to a local dev file; override with DATABASE_URL in .env.local on the server.
    url: process.env["DATABASE_URL"] ?? "file:./prisma/pixsnug.db",
  },
});
