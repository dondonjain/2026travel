import { NextRequest, NextResponse } from 'next/server';
import { resolvePlaceName, PlaceResolveRequest } from '@/lib/cms/place-resolver';
import { validCoordinate } from '@/lib/cms/trajectory-analyzer';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlaceResolveRequest;
    if (!body || !validCoordinate(body.coordinate) ||
        (body.timelinePath !== undefined && (!Array.isArray(body.timelinePath) || body.timelinePath.length > 10000))) {
      return NextResponse.json({ ok: false, error: '場所查詢格式不正確。' }, { status: 400 });
    }
    const result = await resolvePlaceName(body);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, error: '場所查詢失敗，請檢查輸入或稍後重試。' }, { status: 400 });
  }
}
