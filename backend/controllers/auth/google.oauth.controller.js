const crypto = require('crypto');
const User = require('../../models/user/user.model');
const { generateToken } = require('../../utils/response');
const { ensurePersonalWorkspace } = require('../../utils/userOrganization');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';

function getRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const base =
    process.env.API_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  return `${base.replace(/\/$/, '')}/api/auth/google/callback`;
}

function redirectWithError(res, code) {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(
    /\/$/,
    ''
  );
  res.redirect(`${frontend}/login?oauth_error=${encodeURIComponent(code)}`);
}

/**
 * Starts Google OAuth — redirects browser to Google consent.
 */
exports.googleRedirect = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: 'Google OAuth is not configured',
      success: false,
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    maxAge: 10 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  res.redirect(`${GOOGLE_AUTH}?${params.toString()}`);
};

/**
 * Google redirects here with ?code=&state=
 */
exports.googleCallback = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
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
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
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
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(
      /\/$/,
      ''
    );

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
    res.redirect(`${frontend}/auth/google/callback#${frag}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    redirectWithError(res, 'server_error');
  }
};
