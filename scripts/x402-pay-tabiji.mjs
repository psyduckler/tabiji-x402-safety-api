#!/usr/bin/env node
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const privateKey = process.env.X402_BUYER_PRIVATE_KEY;
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error('Set X402_BUYER_PRIVATE_KEY to a funded Base USDC buyer wallet private key.');
  process.exit(2);
}

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({ account, chain: base, transport: http('https://base-rpc.publicnode.com') });
const signer = toClientEvmSigner(walletClient);
const client = new x402Client((version, accepts) => {
  const baseUsdc = accepts.find((req) =>
    req.scheme === 'exact' &&
    req.network === 'eip155:8453' &&
    String(req.asset).toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' &&
    String(req.amount) === '50000' &&
    String(req.payTo).toLowerCase() === '0x59959450bb3da79a8bc07cc078696d6cba3beb4a'
  );
  if (!baseUsdc) throw new Error('Expected Tabiji $0.05 Base USDC payment requirement not found. Refusing to pay.');
  return baseUsdc;
}).register('eip155:8453', new ExactEvmScheme(signer));

const paidFetch = wrapFetchWithPayment(fetch, client);
const body = {
  destination: process.env.TABIJI_DESTINATION || 'Barcelona',
  travelerProfile: process.env.TABIJI_TRAVELER_PROFILE || 'US first-time visitor age 45+',
  includeAlerts: true,
  format: 'agent_brief',
};

const response = await paidFetch('https://x402.tabiji.ai/v1/scam-brief', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const text = await response.text();
let data;
try { data = JSON.parse(text); } catch { data = text; }

console.log(JSON.stringify({
  buyer: account.address,
  status: response.status,
  paymentResponse: response.headers.get('payment-response') || response.headers.get('x-payment-response'),
  data,
}, null, 2));

if (!response.ok) process.exit(1);
