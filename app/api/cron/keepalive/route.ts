import { NextResponse } from 'next/server';

// keepalive：Vercel Cron 发 GET，外部监控服务可能发 POST/GET
function handler() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}

export async function GET() {
  return handler();
}

export async function POST() {
  return handler();
}
