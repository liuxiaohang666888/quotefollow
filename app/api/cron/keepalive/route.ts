import { NextResponse } from 'next/server';

export async function POST() {
  // 简单的 keepalive 端点，防止 Heroku/Railway 等平台的空闲超时
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
