export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = Response.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );

  response.headers.append(
    'Set-Cookie',
    `enotes_access=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );

  return response;
}
