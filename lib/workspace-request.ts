export class WorkspaceRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Count bytes as they arrive: Content-Length is optional and is not a limit.
export async function readWorkspaceAction(req: Request, limit = 200000): Promise<Record<string, unknown>> {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new WorkspaceRequestError('Envie os dados no formato JSON.', 415);
  }
  if (Number(req.headers.get('content-length') || 0) > limit) {
    throw new WorkspaceRequestError('Pedido muito grande.', 413);
  }
  const reader = req.body?.getReader();
  if (!reader) throw new WorkspaceRequestError('Envie os dados do pedido.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new WorkspaceRequestError('Pedido muito grande.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let action: unknown;
  try { action = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { throw new WorkspaceRequestError('Os dados do pedido são inválidos.'); }
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new WorkspaceRequestError('Os dados do pedido são inválidos.');
  }
  const body = action as Record<string, unknown>;
  if (typeof body.type !== 'string' || !body.type.trim() || body.type.length > 40) {
    throw new WorkspaceRequestError('Escolha uma operação válida.');
  }
  return body;
}
