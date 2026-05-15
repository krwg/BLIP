import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import electron from 'electron';

const userData = join(homedir(), '.blip-peer2');

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BLIP_VITE_DEV: '1',
    BLIP_USER_DATA_DIR: userData,
  },
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
