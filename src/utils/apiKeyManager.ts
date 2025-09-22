import { maskApiKey } from "./helpers";

interface ApiKey {
  key: string;
  status: 'available' | 'temporarily_disabled' | 'daily_disabled';
  disabledUntil?: number;
}

export class ApiKeyManager {
  private keys: string[];
  private currentIndex: number = 0;
  private kv: KVNamespace;

  constructor(apiKeyString: string | undefined, kv: KVNamespace) {
    if (!apiKeyString) {
      this.keys = [];
    } else {
      this.keys = apiKeyString.split(',').map(key => key.trim());
    }
    this.kv = kv;
  }

  private async getKey(key: string): Promise<ApiKey> {
    const storedKey = await this.kv.get(key);
    if (storedKey) {
      return JSON.parse(storedKey);
    }
    return {
      key,
      status: 'available',
    };
  }

  private async saveKey(apiKey: ApiKey): Promise<void> {
    await this.kv.put(apiKey.key, JSON.stringify(apiKey));
  }

  public async getAvailableKey(): Promise<string | null> {
    if (this.keys.length === 0) {
      return null;
    }

    const initialIndex = this.currentIndex;
    do {
      const key = this.keys[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      const apiKey = await this.getKey(key);
      console.log(`apiKeyManager - ${maskApiKey(apiKey.key)}: ${apiKey.status}`);

      if (apiKey.status === 'available') {
        return apiKey.key;
      }

      if (apiKey.status === 'temporarily_disabled' && apiKey.disabledUntil) {
        const isExpired = Date.now() > apiKey.disabledUntil;
        if (isExpired) {
          apiKey.status = 'available';
          apiKey.disabledUntil = undefined;
          await this.saveKey(apiKey);
          return apiKey.key;
        }
      }

      if (apiKey.status === 'daily_disabled' && apiKey.disabledUntil) {
        console.log(`apiKeyManager - block until next day: ${apiKey.disabledUntil}`);
        const isExpired = Date.now() > apiKey.disabledUntil;
        if (isExpired) {
          apiKey.status = 'available';
          apiKey.disabledUntil = undefined;
          await this.saveKey(apiKey);
          return apiKey.key;
        }
      }
    } while (this.currentIndex !== initialIndex);

    return null;
  }

  public async disableKeyTemporarily(key: string, duration: number = 1): Promise<void> {
    const apiKey = await this.getKey(key);
    apiKey.status = 'temporarily_disabled';
    apiKey.disabledUntil = Date.now() + duration * 60 * 1000;
    await this.saveKey(apiKey);
  }

  public async disableKeyForDay(key: string): Promise<void> {
    const apiKey = await this.getKey(key);
    const timestampUTC = Date.now();
    const timestampNextMidnightUTC = timestampUTC - (timestampUTC % 86400000) + 86400000;
    const timestampNextMidnightPT = timestampNextMidnightUTC - 3600000 * this.getUTCOffset("America/Los_Angeles");

    apiKey.status = 'daily_disabled';
    apiKey.disabledUntil = timestampNextMidnightPT;
    await this.saveKey(apiKey);
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
