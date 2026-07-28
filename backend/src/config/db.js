const { PrismaClient } = require("@prisma/client");

// Single shared Prisma instance (recommended pattern for Node.js apps)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
