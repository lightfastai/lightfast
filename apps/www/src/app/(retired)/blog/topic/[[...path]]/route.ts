export function GET() {
  return new Response(null, { status: 410 });
}

export { GET as HEAD };
