#!/usr/bin/env node
/**
 * Creates the PixSnug Pro product and $9/month price in Stripe (test mode).
 * Run once after adding your test key to .env.local:
 *
 *   node scripts/create-stripe-product.mjs
 *
 * Copy the printed STRIPE_PRICE_ID_PRO value into .env.local, then rebuild.
 */

import { createRequire } from 'module';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

require('dotenv').config({ path: resolve(__dirname, '../.env.local') });

const Stripe = require('stripe');

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('\n❌  STRIPE_SECRET_KEY is not set in .env.local\n');
  process.exit(1);
}
if (key.startsWith('sk_live_')) {
  console.error('\n❌  Live key detected. Use your TEST key (sk_test_...) for now.\n');
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2026-05-27.preview' });

async function main() {
  console.log('\nCreating PixSnug Pro product in Stripe (test mode)…\n');

  const product = await stripe.products.create({
    name: 'PixSnug Pro',
    description: 'Pro compression — 2 GB videos, 100 req/min, priority processing',
    // txcd_10103100 = SaaS / software subscription (required for Managed Payments tax)
    tax_code: 'txcd_10103100',
    default_price_data: {
      unit_amount: 900,        // $9.00
      currency: 'usd',
      recurring: { interval: 'month' },
    },
  });

  const priceId = product.default_price;

  console.log('✅  Product created :', product.id);
  console.log('✅  Price ID        :', priceId);
  console.log('\n──────────────────────────────────────────────');
  console.log('Add this line to your .env.local (and the server .env.local):');
  console.log('');
  console.log(`STRIPE_PRICE_ID_PRO=${priceId}`);
  console.log('──────────────────────────────────────────────');
  console.log('\nThen rebuild:  npm run build && pm2 restart all\n');
}

main().catch((err) => {
  console.error('\n❌  Error:', err.message, '\n');
  process.exit(1);
});
