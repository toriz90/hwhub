import crypto from 'crypto';

export class EncryptionManager {
  constructor(encryptionKey) {
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is required');
    }
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  encrypt(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex')
    });
  }

  decrypt(encryptedData) {
    const parsed = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(parsed.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  isEncrypted(data) {
    try {
      const parsed = JSON.parse(data);
      return parsed.iv && parsed.data && parsed.authTag;
    } catch {
      return false;
    }
  }
}
