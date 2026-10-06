const TokenManager = require('../src/utils/TokenManager');
const jwt = require('jsonwebtoken');

describe('TokenManager', () => {
  const mockUser = { id: 1, username: 'testuser', role: 'Pengawas' };
  
  it('should generate a valid access token', () => {
    const token = TokenManager.generateAccessToken(mockUser);
    expect(token).toBeDefined();
    
    const decoded = TokenManager.verifyAccessToken(token);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.role).toBe(mockUser.role);
  });

  it('should generate a valid refresh token', () => {
    const token = TokenManager.generateRefreshToken(mockUser);
    expect(token).toBeDefined();
    
    const decoded = TokenManager.verifyRefreshToken(token);
    expect(decoded.username).toBe(mockUser.username);
    expect(decoded.role).toBe(mockUser.role);
  });

  it('should fail to verify invalid token', () => {
    expect(() => {
      TokenManager.verifyAccessToken('invalid.token.here');
    }).toThrow();
  });
});
