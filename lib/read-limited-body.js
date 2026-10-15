export async function readLimitedBody(request, maxBytes) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    const error = new Error(`Request body must be ${maxBytes} bytes or smaller.`);
    error.status = 413;
    throw error;
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        const error = new Error(`Request body must be ${maxBytes} bytes or smaller.`);
        error.status = 413;
        throw error;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString('utf8');
}
