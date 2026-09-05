import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 临时诊断接口：暴露线上 AI 调用的真实错误（排查 Agnes 解析降级问题），用完即删
export async function GET(req: NextRequest) {
  // 临时硬编码令牌：接口本身用完即删
  const secret = req.nextUrl.searchParams.get('key');
  if (secret !== 'tmp-diag-9f3Kx7Qw' && secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL;
  const hasKey = !!process.env.OPENAI_API_KEY;
  const keyPreview = hasKey ? process.env.OPENAI_API_KEY!.slice(0, 6) + '...' + process.env.OPENAI_API_KEY!.slice(-4) : 'MISSING';

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: baseURL || undefined,
    });
    const res = await client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      temperature: 0,
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    });
    return NextResponse.json({
      ok: true,
      baseURL, model, keyPreview,
      reply: res.choices[0]?.message?.content?.slice(0, 50),
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      baseURL, model, keyPreview,
      errorName: e?.name,
      errorMessage: e?.message,
      errorStatus: e?.status,
    });
  }
}
