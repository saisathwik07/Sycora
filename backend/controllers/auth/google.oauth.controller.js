const crypto = require('crypto');
const User = require('../../models/user/user.model');
const { generateToken } = require('../../utils/response');
const { ensurePersonalWorkspace } = require('../../utils/userOrganization');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';

/** SPA origin (Vercel). No trailing slash. */
function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');
}

/**
 * Must exactly match an entry in Google Cloud Console → Authorized redirect URIs.
 * Prefer GOOGLE_REDIRECT_URI in production. Otherwise API_PUBLIC_URL + /api/auth/google/callback.
 */
function getRedirectUri() {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const apiBase = (process.env.API_PUBLIC_URL || '').trim().replace(/\/$/, '');
  const fallbackPort = process.env.PORT || 8080;
  const base = apiBase || `http://localhost:${fallbackPort}`;
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`;
}

function redirectWithError(res, code) {
  const frontend = getFrontendUrl();
  return res.redirect(302, `${frontend}/login?oauth_error=${encodeURIComponent(code)}`);
}

function maskId(id) {
  if (!id || typeof id !== 'string') return '(missing)';
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/**
 * Starts Google OAuth — redirects browser to Google consent.
 * Fully synchronous: no awaited promises (avoids “hang” from unresolved async).
 */
exports.googleRedirect = (req, res) => {
  const rid = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  console.log('[googleOAuth] googleRedirect:start', {
    rid,
    path: req.path,
    originalUrl: req.originalUrl,
    xfProto: req.get('x-forwarded-proto'),
    xfHost: req.get('x-forwarded-host'),
  });

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      console.error('[googleOAuth] googleRedirect:missing_credentials', {
        rid,
        hasClientId: Boolean(clientId),
        hasSecret: Boolean(clientSecret),
      });
      return res.status(503).json({
        message: 'Google OAuth is not configured',
        success: false,
      });
    }

    const redirectUri = getRedirectUri();
    const runningOnRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_PROJECT_ID ||
        process.env.RAILWAY_SERVICE_NAME,
    );
    if (runningOnRailway && /localhost|127\.0\.0\.1/i.test(redirectUri)) {
      console.error(
        '[googleOAuth] googleRedirect:bad_redirect_uri',
        'Set GOOGLE_REDIRECT_URI or API_PUBLIC_URL on Railway (got localhost fallback).',
        { rid, redirectUri }
      );
      return res.status(503).json({
        message:
          'OAuth redirect URI is misconfigured (using localhost on Railway). Set GOOGLE_REDIRECT_URI or API_PUBLIC_URL.',
        success: false,
      });
    }

    const state = crypto.randomBytes(24).toString('hex');
    const useSecureCookies =
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production' ||
      process.env.RAILWAY_ENVIRONMENT === 'production';

    console.log('[googleOAuth] googleRedirect:pre_cookie', {
      rid,
      redirectUri,
      clientId: maskId(clientId),
      useSecureCookies,
    });

    res.cookie('google_oauth_state', state, {
      httpOnly: true,
      maxAge: 10 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'false' ? false : useSecureCookies,
      path: '/',
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    const authUrl = `${GOOGLE_AUTH}?${params.toString()}`;
    console.log('[googleOAuth] googleRedirect:sending_redirect', {
      rid,
      authUrlLen: authUrl.length,
      googleAuthHost: GOOGLE_AUTH,
    });

    return res.redirect(302, authUrl);
  } catch (err) {
    console.error('[googleOAuth] googleRedirect:error', {
      rid,
      message: err?.message,
      stack: err?.stack,
    });
    if (!res.headersSent) {
      return res.status(500).json({
        message: 'Failed to start Google sign-in',
        success: false,
      });
    }
    return undefined;
  }
};

/**
 * Google redirects here with ?code=&state=
 */
exports.googleCallback = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      return redirectWithError(res, 'not_configured');
    }

    const { code, state } = req.query;
    const cookieState = req.cookies?.google_oauth_state;
    res.clearCookie('google_oauth_state', { path: '/' });

    if (
      !code ||
      typeof code !== 'string' ||
      !state ||
      typeof state !== 'string' ||
      !cookieState ||
      state !== cookieState
    ) {
      return redirectWithError(res, 'invalid_state');
    }

    const redirectUri = getRedirectUri();
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', tokens);
      return redirectWithError(res, 'token_exchange_failed');
    }

    const profileRes = await fetch(GOOGLE_USERINFO, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.email || !profile.id) {
      return redirectWithError(res, 'profile_incomplete');
    }

    const email = String(profile.email).toLowerCase().trim();
    const googleId = String(profile.id);

    let user = await User.findOne({ googleId }).select('+googleId');
    if (!user) {
      user = await User.findOne({ email }).select('+googleId +password');
      if (user) {
        if (user.googleId && user.googleId !== googleId) {
          return redirectWithError(res, 'account_conflict');
        }
        user.googleId = googleId;
        user.authProvider = user.password ? 'local' : 'google';
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        email,
        googleId,
        authProvider: 'google',
        role: 'user',
        onboardingCompleted: false,
      });
    }

    let hydratedUser = await User.findById(user._id).populate('organization', 'name');
    const deliberatelyPendingWorkspace =
      hydratedUser.onboardingCompleted === true &&
      !hydratedUser.isGuest &&
      hydratedUser.role !== 'super' &&
      !hydratedUser.organization &&
      !(hydratedUser.memberships?.length);

    if (
      !hydratedUser.organization &&
      hydratedUser.role !== 'super' &&
      hydratedUser.onboardingCompleted !== false &&
      !hydratedUser.isGuest &&
      !deliberatelyPendingWorkspace
    ) {
      hydratedUser = await ensurePersonalWorkspace(user._id);
    }

    const token = generateToken(hydratedUser);
    const frontend = getFrontendUrl();

    const meta = {
      expiresIn: 3600,
      role: hydratedUser.role,
      email: hydratedUser.email,
      organization: hydratedUser.organization
        ? {
            id: String(hydratedUser.organization._id),
            name: hydratedUser.organization.name,
          }
        : null,
      needsOnboarding:
        hydratedUser.role !== 'super' &&
        hydratedUser.onboardingCompleted === false,
    };

    const metaEncoded = encodeURIComponent(JSON.stringify(meta));
    const frag = `token=${encodeURIComponent(token)}&meta=${metaEncoded}`;
    return res.redirect(302, `${frontend}/auth/google/callback#${frag}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err?.stack || err?.message || err);
    if (!res.headersSent) {
      return redirectWithError(res, 'server_error');
    }
    return undefined;
  }
};
