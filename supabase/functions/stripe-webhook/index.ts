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

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  // Only process checkout.session.completed events
  if (event.type !== 'checkout.session.completed') {
    return;
  }

  const session = stripeData as Stripe.Checkout.Session;
  const { mode, payment_status, id: checkout_session_id } = session;

  // Only process one-time payments (mode === 'payment')
  if (mode !== 'payment') {
    console.info(`Skipping non-payment mode checkout session: ${checkout_session_id}`);
    return;
  }

  // Only process paid sessions
  if (payment_status !== 'paid') {
    console.info(`Skipping unpaid checkout session: ${checkout_session_id}`);
    return;
  }

  try {
    // Extract the necessary information from the session
    const {
      payment_intent,
      amount_subtotal,
      amount_total,
      currency,
      customer_email,
    } = session;

    // For one-time payments, customer email should be available
    if (!customer_email) {
      console.warn(`No customer email found for checkout session: ${checkout_session_id}`);
      // Continue processing; email is useful but not strictly required
    }

    // Check if we've already processed this session (idempotency)
    const { data: existingOrder } = await supabase
      .from('stripe_orders')
      .select('id')
      .eq('checkout_session_id', checkout_session_id)
      .maybeSingle();

    if (existingOrder) {
      console.info(`Checkout session already processed: ${checkout_session_id}`);
      return;
    }

    // Insert the order into the stripe_orders table
    const { error: orderError } = await supabase.from('stripe_orders').insert({
      checkout_session_id,
      payment_intent_id: payment_intent,
      customer_id: null, // For one-time payments, customer_id may not be set
      customer_email: customer_email || null,
      amount_subtotal,
      amount_total,
      currency,
      payment_status,
      status: 'completed',
    });

    if (orderError) {
      console.error('Error inserting order:', orderError);
      throw new Error(`Failed to insert order: ${orderError.message}`);
    }

    console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
  } catch (error) {
    console.error('Error processing one-time payment:', error);
    throw error;
  }
}
