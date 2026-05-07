import { resolveApiUrl } from './environment.common';

const remoteApi = 'https://stunning-miracle-production.up.railway.app/api';

export const environment = {
  production: true,
  apiUrl: resolveApiUrl(remoteApi),
};
