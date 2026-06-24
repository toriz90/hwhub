export class RateLimiter {
  constructor(maxRequests = 20, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(ip) {
    const now = Date.now();
    const key = ip;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key);
    const recentRequests = timestamps.filter(ts => now - ts < this.windowMs);

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    if (recentRequests.length === 1) {
      setTimeout(() => {
        if (this.requests.has(key) && this.requests.get(key).length === 1) {
          this.requests.delete(key);
        }
      }, this.windowMs);
    }

    return true;
  }

  getRemainingRequests(ip) {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];
    const recentRequests = timestamps.filter(ts => now - ts < this.windowMs);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  reset(ip) {
    this.requests.delete(ip);
  }
}
