import { describe, expect, it } from 'vitest';
import { createTcpLineReader, MAX_TCP_LINE_BYTES } from '../main/tcp-framing.js';

function serialize(payload) {
  return `${JSON.stringify(payload)}\n`;
}

describe('TCP framing', () => {
  it('round-trips a JSON message across chunk boundaries', () => {
    const reader = createTcpLineReader();
    const msg = {
      type: 'message',
      from: 2,
      to: 5,
      text: 'hello mesh',
      ts: 1710000000000,
    };
    const line = serialize(msg);
    const mid = Math.floor(line.length / 2);
    expect(reader.push(line.slice(0, mid))).toEqual([]);
    const lines = reader.push(line.slice(mid));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual(msg);
  });

  it('skips blank lines and returns multiple payloads', () => {
    const reader = createTcpLineReader();
    const a = { type: 'ping', from: 1 };
    const b = { type: 'pong', from: 2 };
    const lines = reader.push(`${serialize(a)}\n${serialize(b)}`);
    expect(lines.map((l) => JSON.parse(l))).toEqual([a, b]);
  });

  it('throws LINE_TOO_LARGE when a line exceeds the cap', () => {
    const reader = createTcpLineReader();
    const huge = 'x'.repeat(MAX_TCP_LINE_BYTES + 1);
    expect(() => reader.push(huge)).toThrowError(/too large/i);
    try {
      reader.push(huge);
    } catch (err) {
      expect(err.code).toBe('LINE_TOO_LARGE');
    }
  });
});
