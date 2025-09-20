interface ApiKey {
  key: string;
  status: 'available' | 'temporarily_disabled' | 'daily_disabled';
  disabledUntil?: number;
}

export class ApiKeyManager {
  private keys: ApiKey[];
  private currentIndex: number = 0;

  constructor(apiKeyString: string | undefined) {
    if (!apiKeyString) {
      this.keys = [];
      return;
    }
    this.keys = apiKeyString.split(',').map(key => ({
      key: key.trim(),
      status: 'available',
    }));
  }

  public getAvailableKey(): string | null {
    if (this.keys.length === 0) {
      console.log('APIKeyManager: No API keys configured.');
      return null;
    }

    const initialIndex = this.currentIndex;
    console.log(`APIKeyManager: Starting key check from index ${initialIndex}. Total keys: ${this.keys.length}`);
    do {
      const apiKey = this.keys[this.currentIndex];
      console.log(`APIKeyManager: Checking key at index ${this.currentIndex}: status=${apiKey.status}`);
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;

      if (apiKey.status === 'available') {
        console.log(`APIKeyManager: Found available key at index ${this.currentIndex}`);
        return apiKey.key;
      }

      if (apiKey.status === 'temporarily_disabled' && apiKey.disabledUntil) {
        const isExpired = Date.now() > apiKey.disabledUntil;
        console.log(`APIKeyManager: Key at index ${this.currentIndex} is temporarily disabled. Checking if expired. Expired: ${isExpired}`);
        if (isExpired) {
          apiKey.status = 'available';
          apiKey.disabledUntil = undefined;
          return apiKey.key;
        }
      }

      if (apiKey.status === 'daily_disabled' && apiKey.disabledUntil) {
        // Check if the current date in PT is past the disabled date in PT.
        const disabledDateStr = new Date(apiKey.disabledUntil).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
        const currentDateStr = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
        const isExpired = currentDateStr > disabledDateStr;
        console.log(`APIKeyManager: Key at index ${this.currentIndex} is daily disabled. Disabled date (PT): ${disabledDateStr}, Current date (PT): ${currentDateStr}. Expired: ${isExpired}`);
        if (isExpired) {
            apiKey.status = 'available';
            apiKey.disabledUntil = undefined;
            return apiKey.key;
        }
      }
    } while (this.currentIndex !== initialIndex);

    console.log('APIKeyManager: No available keys found after checking all keys.');
    return null;
  }

  public disableKeyTemporarily(key: string): void {
    const apiKey = this.keys.find(k => k.key === key);
    if (apiKey) {
      console.log(`APIKeyManager: Temporarily disabling key: ${key}`);
      apiKey.status = 'temporarily_disabled';
      apiKey.disabledUntil = Date.now() + 60 * 1000; // 1 minute
    }
  }

  public disableKeyForDay(key: string): void {
    const apiKey = this.keys.find(k => k.key === key);
    if (apiKey) {
      console.log(`APIKeyManager: Disabling key for the day: ${key}`);
      apiKey.status = 'daily_disabled';
      apiKey.disabledUntil = Date.now();
    }
  }

  public getTotalKeys(): number {
    return this.keys.length;
  }
}
