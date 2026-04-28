type PublicEnvName =
  | 'EXPO_PUBLIC_HELIUS_PROXY_URL'
  | 'EXPO_PUBLIC_API_DEMO_ENDPOINT'
  | 'EXPO_PUBLIC_API_DEMO_KEY'
  | 'EXPO_PUBLIC_ENG_CHALLENGE_ENDPOINT'
  | 'EXPO_PUBLIC_ENG_CHALLENGE_API_KEY'
  | 'EXPO_PUBLIC_GRAFANA_URL';

type RuntimeEnv = Partial<Record<PublicEnvName, string>>;

declare global {
  interface Window {
    __HELIUS_DEMO_ENV__?: RuntimeEnv;
  }
}

const getBundledEnv = (name: PublicEnvName): string => {
  const env: Record<PublicEnvName, string | undefined> = {
    EXPO_PUBLIC_HELIUS_PROXY_URL: process.env.EXPO_PUBLIC_HELIUS_PROXY_URL,
    EXPO_PUBLIC_API_DEMO_ENDPOINT: process.env.EXPO_PUBLIC_API_DEMO_ENDPOINT,
    EXPO_PUBLIC_API_DEMO_KEY: process.env.EXPO_PUBLIC_API_DEMO_KEY,
    EXPO_PUBLIC_ENG_CHALLENGE_ENDPOINT: process.env.EXPO_PUBLIC_ENG_CHALLENGE_ENDPOINT,
    EXPO_PUBLIC_ENG_CHALLENGE_API_KEY: process.env.EXPO_PUBLIC_ENG_CHALLENGE_API_KEY,
    EXPO_PUBLIC_GRAFANA_URL: process.env.EXPO_PUBLIC_GRAFANA_URL,
  };

  return env[name] || '';
};

export const getPublicEnv = (name: PublicEnvName): string => {
  if (typeof window !== 'undefined' && window.__HELIUS_DEMO_ENV__?.[name]) {
    return window.__HELIUS_DEMO_ENV__[name] || '';
  }

  return getBundledEnv(name);
};
