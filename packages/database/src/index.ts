export { prisma } from './client.js';
// Re-export Prisma namespace so consumer apps can reach the JSON helpers
// (Prisma.JsonNull, Prisma.InputJsonValue, etc.) without depending on
// @prisma/client directly. Keeps the dependency boundary clean — only this
// package owns @prisma/client.
export { Prisma } from '@prisma/client';

// AAT-RZP / Wave 7: re-export billing model types + enums so api can use
// them without depending on @prisma/client directly.
export type {
  Subscription,
  Invoice,
  RazorpayOrder,
  RazorpayWebhookEvent,
  SubscriptionPlan,
  SubscriptionRegion,
  SubscriptionStatus,
  InvoiceStatus,
  RazorpayOrderStatus,
} from '@prisma/client';

// AAT-EMAIL / Wave 8b: re-export OutboundEmail audit model + EmailStatus
// enum so api can persist send attempts without depending on
// @prisma/client directly.
export type {
  OutboundEmail,
  EmailStatus,
} from '@prisma/client';
