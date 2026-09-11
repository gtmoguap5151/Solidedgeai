import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!stripeSecret || !stripeWebhookSecret || !supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required Stripe or Supabase environment configuration.');
}

const stripe = new Stripe(stripeSecret, { appInfo: { name: 'Solid Edge AI', version: '1.0.0' } });
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing Stripe signature', { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Webhook signature verification failed:', message);
    return new Response('Invalid webhook signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') return Response.json({ received: true, ignored: true });

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return Response.json({ received: true, ignored: true });

  try {
    const email = session.customer_details?.email ?? session.customer_email;
    const name = session.customer_details?.name ?? null;
    const amountPaid = session.amount_total ?? 0;

    if (!email) {
      console.error('Paid checkout session has no customer email:', session.id);
      return Response.json({ error: 'Paid checkout session is missing customer email.' }, { status: 500 });
    }

    const { data: existingPurchase, error: lookupError } = await supabase
      .from('course_purchases')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let purchaseId = existingPurchase?.id as string | undefined;
    if (!purchaseId) {
      const { data: purchase, error: purchaseError } = await supabase
        .from('course_purchases')
        .insert({ stripe_session_id: session.id, email, name, amount_paid: amountPaid, status: 'paid' })
        .select('id')
        .single();
      if (purchaseError || !purchase) throw purchaseError ?? new Error('Purchase record was not created.');
      purchaseId = purchase.id;
    }

    const { data: existingLink, error: linkLookupError } = await supabase
      .from('download_links')
      .select('id, token')
      .eq('purchase_id', purchaseId)
      .maybeSingle();
    if (linkLookupError) throw linkLookupError;

    if (!existingLink) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { error: linkError } = await supabase.from('download_links').insert({ purchase_id: purchaseId, max_downloads: 5, expires_at: expiresAt.toISOString() });
      if (linkError) throw linkError;
    }

    console.info('Processed paid Solid Edge AI course purchase:', session.id);
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error processing paid course purchase:', message);
    return Response.json({ error: 'Failed to fulfill purchase.' }, { status: 500 });
  }
});
