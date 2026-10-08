// lib/prisma.js
// Shared PrismaClient instance to avoid multiple connection pools (K8 fix)

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;