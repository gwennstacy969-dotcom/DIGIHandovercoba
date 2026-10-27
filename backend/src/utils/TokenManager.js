const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_negara_pertamina_123';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_rahasia_negara_pertamina_123';

class TokenManager {
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
      JWT_SECRET,
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
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }

  static verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  static verifyRefreshToken(token) {
    return jwt.verify(token, REFRESH_SECRET);
  }
}

module.exports = TokenManager;
