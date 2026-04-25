/**
 * AAT-CHECKOUT / Wave 8a: Razorpay Checkout.js loader + helper.
 *
 * Loads `https://checkout.razorpay.com/v1/checkout.js` on demand (no npm
 * package; the SDK is unauthenticated public script). Resolves with the
 * global `Razorpay` constructor so callers can construct + open the modal.
 *
 * The SDK is loaded lazily ONCE per page — repeated calls reuse the same
 * promise so racing CTA clicks don't inject duplicate <script> tags.
 *
 * The public Razorpay key id (`keyId`) is NEVER stored client-side as a
 * static constant — it comes back from `POST /api/v1/billing/checkout`
 * each time so the server is the single source of truth for which key
 * (live vs test) to use.
 */

/* ============================================
   Razorpay SDK type surface (thin)
   ============================================ */

export interface RazorpayPaymentSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayPaymentFailure {
  reason: 'modal_closed' | 'payment_failed';
  code?: string;
  description?: string;
  source?: string;
  step?: string;
  metadata?: Record<string, unknown>;
}

interface RazorpayInstanceOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayPaymentSuccess) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (
    event: 'payment.failed',
    handler: (response: { error: { code?: string; description?: string; source?: string; step?: string; metadata?: Record<string, unknown> } }) => void,
  ) => void;
}

export type RazorpayCheckoutFn = new (options: RazorpayInstanceOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutFn;
  }
}

/* ============================================
   Loader
   ============================================ */

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let pendingLoad: Promise<RazorpayCheckoutFn> | null = null;

/**
 * Inject `checkout.js` if absent and resolve with the global Razorpay
 * constructor. Idempotent — repeated calls reuse the same promise.
 */
export function loadRazorpayCheckout(): Promise<RazorpayCheckoutFn> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only be loaded in the browser'));
  }
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  if (pendingLoad) return pendingLoad;

  pendingLoad = new Promise<RazorpayCheckoutFn>((resolve, reject) => {
    // Re-use the existing tag if a previous mount injected it.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`,
    );

    const handleLoad = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        reject(new Error('Razorpay script loaded but window.Razorpay is undefined'));
      }
    };

    const handleError = () => {
      pendingLoad = null;
      reject(new Error('Failed to load Razorpay Checkout SDK'));
    };

    if (existing) {
      existing.addEventListener('load', handleLoad);
      existing.addEventListener('error', handleError);
      // Already-loaded tags don't fire 'load' again — guard the live ref.
      if (window.Razorpay) handleLoad();
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    document.head.appendChild(script);
  });

  return pendingLoad;
}

/* ============================================
   Helper — open the modal in one call
   ============================================ */

export interface OpenRazorpayCheckoutInput {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  themeColor?: string;
  onSuccess: (response: RazorpayPaymentSuccess) => void;
  onFailure: (failure: RazorpayPaymentFailure) => void;
}

/**
 * One-call convenience: load the SDK if needed, build the Razorpay
 * instance, attach the failure / dismiss listeners, and `.open()` the
 * Checkout modal. The caller is responsible for translating the success
 * payload into a `POST /billing/checkout/success` call.
 */
export async function openRazorpayCheckout(
  input: OpenRazorpayCheckoutInput,
): Promise<void> {
  const Ctor = await loadRazorpayCheckout();

  const instance = new Ctor({
    key: input.keyId,
    amount: input.amount,
    currency: input.currency,
    name: input.name ?? 'Aurex',
    description: input.description ?? 'Subscription payment',
    order_id: input.orderId,
    prefill: input.prefill ?? {},
    notes: input.notes,
    theme: { color: input.themeColor ?? '#1a5d3d' },
    handler: input.onSuccess,
    modal: {
      ondismiss: () => input.onFailure({ reason: 'modal_closed' }),
    },
  });

  instance.on('payment.failed', (response) => {
    input.onFailure({
      reason: 'payment_failed',
      code: response.error?.code,
      description: response.error?.description,
      source: response.error?.source,
      step: response.error?.step,
      metadata: response.error?.metadata,
    });
  });

  instance.open();
}
