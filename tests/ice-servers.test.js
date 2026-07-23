import { describe, expect, it } from 'vitest';
import {
  parseIceServerLines,
  resolveIceServers,
  rtcConfiguration,
} from '../shared/ice-servers.js';

describe('ice-servers', () => {
  it('parses STUN and TURN lines', () => {
    const text = `
# comment
stun:stun.example:3478
turn:turn.example:3478|alice|s3cret
stuns:stun.example:5349
`;
    expect(parseIceServerLines(text)).toEqual([
      { urls: 'stun:stun.example:3478' },
      { urls: 'turn:turn.example:3478', username: 'alice', credential: 's3cret' },
      { urls: 'stuns:stun.example:5349' },
    ]);
  });

  it('ignores invalid schemes', () => {
    expect(parseIceServerLines('http://bad\nstun:ok:1')).toEqual([
      { urls: 'stun:ok:1' },
    ]);
  });

  it('resolveIceServers is empty when disabled', () => {
    expect(
      resolveIceServers({
        iceEnabled: false,
        iceServerLines: 'stun:stun.example:3478',
      }),
    ).toEqual([]);
  });

  it('rtcConfiguration uses resolved servers when enabled', () => {
    expect(
      rtcConfiguration({
        iceEnabled: true,
        iceServerLines: 'stun:a:1,stun:b:2',
      }),
    ).toEqual({
      iceServers: [{ urls: 'stun:a:1' }, { urls: 'stun:b:2' }],
    });
  });
});
