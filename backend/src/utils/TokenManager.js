const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '') {
    return process.env.JWT_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test_jwt_secret_automated_suite_32chars';
  }
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing in non-test runtime! Please configure a secure secret in .env.');
}

function getRefreshSecret() {
  if (process.env.REFRESH_SECRET && process.env.REFRESH_SECRET.trim() !== '') {
    return process.env.REFRESH_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test_refresh_secret_automated_suite_32chars';
  }
  throw new Error('FATAL SECURITY ERROR: REFRESH_SECRET environment variable is missing in non-test runtime! Please configure a secure secret in .env.');
}

class TokenManager {
  static getJwtSecret() {
    return getJwtSecret();
  }

  static getRefreshSecret() {
    return getRefreshSecret();
  }

  static generateAccessToken(user, sessionId = null) {
    const sid = sessionId || user.activeSessionId || null;
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    if (sid) {
      payload.sessionId = sid;
    }
    return jwt.sign(
      payload,
      getJwtSecret(),
      { expiresIn: '1d' }
    );
  }

  static generateRefreshToken(user, sessionId = null) {
    const sid = sessionId || user.activeSessionId || null;
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    if (sid) {
      payload.sessionId = sid;
    }
    return jwt.sign(
      payload,
      getRefreshSecret(),
      { expiresIn: '7d' }
    );
  }

  static verifyAccessToken(token) {
    return jwt.verify(token, getJwtSecret());
  }

  static verifyRefreshToken(token) {
    return jwt.verify(token, getRefreshSecret());
  }
}

module.exports = TokenManager;
