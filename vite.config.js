import { defineConfig, loadEnv } from 'vite';

function stripWrappingQuotes(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientId = stripWrappingQuotes(env.VITE_SPOTIFY_CLIENT_ID || '');
  const redirectUri = stripWrappingQuotes(env.VITE_SPOTIFY_REDIRECT_URI || '');
  return {
    server: {
      host: '127.0.0.1',
      port: 8888,
      strictPort: true,
    },
    define: {
      'globalThis.__SPOTIFY_CLIENT_ID__': JSON.stringify(clientId),
      'globalThis.__SPOTIFY_REDIRECT_URI__': JSON.stringify(redirectUri),
    },
  };
});
