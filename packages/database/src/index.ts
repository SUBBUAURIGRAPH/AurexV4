export { prisma } from './client.js';
// Re-export Prisma namespace so consumer apps can reach the JSON helpers
// (Prisma.JsonNull, Prisma.InputJsonValue, etc.) without depending on
// @prisma/client directly. Keeps the dependency boundary clean — only this
// package owns @prisma/client.
export { Prisma } from '@prisma/client';
