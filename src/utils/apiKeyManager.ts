import { maskApiKey } from "./helpers";

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
      return null;
    }

    const initialIndex = this.currentIndex;
    do {
      const apiKey = this.keys[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      console.log(`${maskApiKey(apiKey.key)}: ${apiKey.status}`);

      if (apiKey.status === 'available') {
        return apiKey.key;
      }

      if (apiKey.status === 'temporarily_disabled' && apiKey.disabledUntil) {
        const isExpired = Date.now() > apiKey.disabledUntil;
        if (isExpired) {
          apiKey.status = 'available';
          apiKey.disabledUntil = undefined;
          return apiKey.key;
        }
      }

      if (apiKey.status === 'daily_disabled' && apiKey.disabledUntil) {
        // Check if the current date in PT is past the disabled date in PT.
        const disabledDateStr = new Date(apiKey.disabledUntil).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
        







/*
        const disabledDateStr = new Date(apiKey.disabledUntil).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
        const currentDateStr = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
        const isExpired = currentDateStr > disabledDateStr;
        if (isExpired) {
            apiKey.status = 'available';
            apiKey.disabledUntil = undefined;
            return apiKey.key;
        }
      }
*/
    } while (this.currentIndex !== initialIndex);

    return null;
  }

  public disableKeyTemporarily(key: string): void {
    const apiKey = this.keys.find(k => k.key === key);
    if (apiKey) {
      apiKey.status = 'temporarily_disabled';
      apiKey.disabledUntil = Date.now() + 60 * 1000; // 1 minute
    }
  }

  public disableKeyForDay(key: string): void {
    const apiKey = this.keys.find(k => k.key === key);
    if (apiKey) {
      apiKey.status = 'daily_disabled';
      apiKey.disabledUntil = Date.now();
    }
  }

  public getTotalKeys(): number {
    return this.keys.length;
  }
}
