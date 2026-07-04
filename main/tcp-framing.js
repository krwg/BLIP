
export const MAX_TCP_LINE_BYTES = 4 * 1024 * 1024;

export function createTcpLineReader(onOverflow) {
  let buffer = '';

  function reset() {
    buffer = '';
  }

  function push(chunk) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (buffer.length > MAX_TCP_LINE_BYTES) {
      buffer = '';
      onOverflow?.();
      const err = new Error('TCP line too large');
      err.code = 'LINE_TOO_LARGE';
      throw err;
    }
    const lines = [];
    let idx = buffer.indexOf('\n');
    while (idx >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.trim()) lines.push(line);
      idx = buffer.indexOf('\n');
    }
    return lines;
  }

  return { push, reset };
}
