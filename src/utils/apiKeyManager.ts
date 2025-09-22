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
      console.log(`apiKeyManager - ${maskApiKey(apiKey.key)}: ${apiKey.status}`);

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
        console.log(`apiKeyManager - block until next day: ${apiKey.disabledUntil}`);
        const isExpired = Date.now() > apiKey.disabledUntil;
        if (isExpired) {
          apiKey.status = 'available';
          apiKey.disabledUntil = undefined;
          return apiKey.key;
        }
      }
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
      const timestampUTC = Date.now();
      const timestampNextMidnightUTC = timestampUTC - (timestampUTC % 86400000) + 86400000;
      const timestampNextMidnightPT = timestampNextMidnightUTC - 3600000 * this.getUTCOffset("America/Los_Angeles");

      apiKey.status = 'daily_disabled';
      apiKey.disabledUntil = timestampNextMidnightPT;
    }
  }

  public getTotalKeys(): number {
    return this.keys.length;
  }

  private getUTCOffset(timeZone: string = "UTC", ts: number = Date.now()): number {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset"
    });

    const parts = fmt.formatToParts(new Date(ts));
    const tzPart = parts.find(p => p.type === "timeZoneName")?.value || "GMT+0";

    const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (!match) return 0;

    const hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;

    return hours + minutes / 60;
  }
}
