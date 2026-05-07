import { resolveApiUrl } from './environment.common';

const remoteApi = 'https://stunning-miracle-production.up.railway.app/api';

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(remoteApi),
};
