import { HttpInterceptorFn } from '@angular/common/http';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const raw = sessionStorage.getItem('token');
  const authToken = raw?.trim();
  if (!authToken) {
    return next(req);
  }
  const authRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return next(authRequest);
};
