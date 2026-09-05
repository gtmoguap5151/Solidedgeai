import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  // Only handle checkout.session.completed events
  if (event.type !== 'checkout.session.completed') {
    return;
  }

  const session = stripeData as Stripe.Checkout.Session;
  const { mode, payment_status, id: checkout_session_id } = session;

  // Only process one-time payments (not subscriptions)
  if (mode === 'subscription') {
    console.info(`Skipping subscription checkout session: ${checkout_session_id}`);
    return;
  }

  // Only process successful payments
  if (payment_status !== 'paid') {
    console.info(`Skipping unpaid checkout session: ${checkout_session_id}`);
    return;
  }

  try {
    // Extract payment information
    const {
      payment_intent,
      customer_email,
      customer_name,
      amount_subtotal,
      amount_total,
      currency,
    } = session;

    // Idempotency check: ensure we haven't already processed this session
    const { data: existingPurchase } = await supabase
      .from('course_purchases')
      .select('id')
      .eq('stripe_session_id', checkout_session_id)
      .maybeSingle();

    if (existingPurchase) {
      console.info(`Purchase already exists for session ${checkout_session_id}, skipping duplicate`);
      return;
    }

    // Create course purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('course_purchases')
      .insert({
        stripe_session_id: checkout_session_id,
        stripe_payment_intent_id: payment_intent,
        customer_email: customer_email || 'unknown@example.com',
        customer_name: customer_name || null,
        amount_paid: amount_total || 0,
        currency: currency || 'usd',
        status: 'paid',
      })
      .select('id')
      .single();

    if (purchaseError || !purchase) {
      console.error('Error creating purchase record:', purchaseError);
      throw new Error('Failed to create purchase record');
    }

    console.info(`Created purchase record: ${purchase.id}`);

    // Create download link (30 days from now, max 5 downloads)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { data: downloadLink, error: linkError } = await supabase
      .from('download_links')
      .insert({
        purchase_id: purchase.id,
        download_count: 0,
        max_downloads: 5,
        expires_at: expiresAt.toISOString(),
      })
      .select('token')
      .single();

    if (linkError || !downloadLink) {
      console.error('Error creating download link:', linkError);
      throw new Error('Failed to create download link');
    }

    console.info(`Successfully processed one-time payment for session: ${checkout_session_id}, token: ${downloadLink.token}`);
  } catch (error) {
    console.error('Error processing one-time payment:', error);
  }
}
