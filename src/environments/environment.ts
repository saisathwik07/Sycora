import { resolveApiUrl } from './environment.common';

const remoteApi = 'https://task-management-app-8t3d.vercel.app/api';

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(remoteApi),
};
