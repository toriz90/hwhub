import crypto from 'crypto';

export class CSRFProtection {
  constructor() {
    this.tokens = new Map();
    this.tokenExpiry = 24 * 60 * 60 * 1000;
    this.sessionTokens = new Map();
  }

  generateToken(sessionId = null) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.tokenExpiry;
    this.tokens.set(token, { expiresAt, sessionId });
    
    if (sessionId) {
      if (!this.sessionTokens.has(sessionId)) {
        this.sessionTokens.set(sessionId, []);
      }
      this.sessionTokens.get(sessionId).push(token);
    }
    
    setTimeout(() => {
      this.tokens.delete(token);
    }, this.tokenExpiry);

    return token;
  }

  validateToken(token, sessionId = null) {
    if (!this.tokens.has(token)) {
      return false;
    }
    const data = this.tokens.get(token);
    if (Date.now() > data.expiresAt) {
      this.tokens.delete(token);
      return false;
    }
    if (sessionId && data.sessionId !== sessionId) {
      return false;
    }
    return true;
  }

  revokeToken(token) {
    const data = this.tokens.get(token);
    if (data && data.sessionId) {
      const tokens = this.sessionTokens.get(data.sessionId) || [];
      const idx = tokens.indexOf(token);
      if (idx > -1) tokens.splice(idx, 1);
    }
    this.tokens.delete(token);
  }

  revokeSessionTokens(sessionId) {
    const tokens = this.sessionTokens.get(sessionId) || [];
    tokens.forEach(token => this.tokens.delete(token));
    this.sessionTokens.delete(sessionId);
  }
}
