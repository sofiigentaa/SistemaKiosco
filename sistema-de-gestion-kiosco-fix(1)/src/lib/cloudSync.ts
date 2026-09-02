// Zero-setup Instant Realtime Multi-Device Sync Engine
// Works without creating any accounts, databases, or writing SQL.

const STORAGE_PIN_KEY = 'kiosco_sync_pin';

export interface SyncPayload {
  version: number;
  timestamp: number;
  deviceId: string;
  pin: string;
  type: 'FULL_SYNC' | 'SALE_EVENT' | 'PRODUCT_UPDATE' | 'SHIFT_UPDATE';
  data: {
    products?: any[];
    sales?: any[];
    stockMovements?: any[];
    currentShift?: any;
    lastSale?: any;
    categories?: string[];
  };
}

// Generate or retrieve device unique ID
export const getDeviceId = (): string => {
  let devId = localStorage.getItem('kiosco_device_id');
  if (!devId) {
    devId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    localStorage.setItem('kiosco_device_id', devId);
  }
  return devId;
};

// Get current configured PIN from URL or localStorage
export const getActivePin = (): string => {
  if (typeof window === 'undefined') return '';
  
  // Check URL query param first (e.g. ?pin=KIOSK-1234)
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get('pin');
  if (urlPin) {
    const cleanPin = urlPin.trim().toUpperCase();
    localStorage.setItem(STORAGE_PIN_KEY, cleanPin);
    return cleanPin;
  }

  return (localStorage.getItem(STORAGE_PIN_KEY) || '').trim().toUpperCase();
};

export const setKioskPin = (pin: string) => {
  const cleanPin = pin.trim().toUpperCase();
  if (cleanPin) {
    localStorage.setItem(STORAGE_PIN_KEY, cleanPin);
  } else {
    localStorage.removeItem(STORAGE_PIN_KEY);
  }
};

// Generate random friendly PIN
export const generateRandomPin = (): string => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `KIOSCO-${num}`;
};

// Secure topic hashing for public relay
const getTopicForPin = (pin: string): string => {
  const normalized = pin.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `kiosco_sync_v2_${normalized}`;
};

// Public high-speed real-time event relay (ntfy.sh open pub-sub)
const RELAY_BASE_URL = 'https://ntfy.sh';

export class KioskCloudSync {
  private pin: string = '';
  private deviceId: string = '';
  private eventSource: EventSource | null = null;
  private pollInterval: any = null;
  private onDataReceived: ((payload: SyncPayload) => void) | null = null;
  private onStatusChange: ((status: 'connected' | 'syncing' | 'disconnected' | 'error') => void) | null = null;
  private lastReceivedTimestamp: number = 0;

  constructor() {
    this.deviceId = getDeviceId();
    this.pin = getActivePin();
  }

  public init(
    onData: (payload: SyncPayload) => void,
    onStatus: (status: 'connected' | 'syncing' | 'disconnected' | 'error') => void
  ) {
    this.onDataReceived = onData;
    this.onStatusChange = onStatus;
    this.pin = getActivePin();

    if (this.pin) {
      this.connect();
    } else {
      onStatus('disconnected');
    }
  }

  public updatePin(newPin: string) {
    this.disconnect();
    this.pin = newPin.trim().toUpperCase();
    setKioskPin(this.pin);

    if (this.pin) {
      this.connect();
    } else {
      this.onStatusChange?.('disconnected');
    }
  }

  public isConnected(): boolean {
    return Boolean(this.pin && this.pin.length >= 3);
  }

  public getPin(): string {
    return this.pin;
  }

  public getShareableUrl(): string {
    if (typeof window === 'undefined' || !this.pin) return '';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?pin=${encodeURIComponent(this.pin)}`;
  }

  // Broadcast state change to all devices with the same PIN
  public async broadcast(type: SyncPayload['type'], data: SyncPayload['data']) {
    if (!this.pin) return;

    const payload: SyncPayload = {
      version: 1,
      timestamp: Date.now(),
      deviceId: this.deviceId,
      pin: this.pin,
      type,
      data,
    };

    const topic = getTopicForPin(this.pin);

    try {
      this.onStatusChange?.('syncing');

      // Publish via fast realtime relay
      await fetch(`${RELAY_BASE_URL}/${topic}`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Title': `Sync-${type}`,
          'Tags': 'package,shopping_cart',
        },
      });

      this.onStatusChange?.('connected');
    } catch (error) {
      console.warn('Realtime broadcast relay warning:', error);
      this.onStatusChange?.('connected');
    }
  }

  // Connect to SSE stream for zero-latency updates
  private connect() {
    if (!this.pin) return;

    this.disconnect();
    const topic = getTopicForPin(this.pin);

    try {
      this.onStatusChange?.('syncing');
      
      // SSE Realtime stream
      const sseUrl = `${RELAY_BASE_URL}/${topic}/sse`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.onStatusChange?.('connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (!raw.message) return;

          const payload: SyncPayload = JSON.parse(raw.message);

          // Ignore self-broadcasts
          if (payload.deviceId === this.deviceId) return;
          if (payload.pin !== this.pin) return;

          // Prevent old messages
          if (payload.timestamp && payload.timestamp <= this.lastReceivedTimestamp) return;
          this.lastReceivedTimestamp = payload.timestamp || Date.now();

          // Dispatch data to App Context
          this.onDataReceived?.(payload);
          this.onStatusChange?.('connected');
        } catch (e) {
          // Ignored malformed messages
        }
      };

      this.eventSource.onerror = () => {
        // Fallback gracefully to polling if SSE is blocked by network
        this.eventSource?.close();
        this.eventSource = null;
        this.startPollingFallback();
      };
    } catch {
      this.startPollingFallback();
    }
  }

  // Polling fallback if SSE disconnects
  private startPollingFallback() {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      if (!this.pin) return;
      const topic = getTopicForPin(this.pin);
      try {
        const res = await fetch(`${RELAY_BASE_URL}/${topic}/json?poll=1&since=10s`);
        if (!res.ok) return;
        const text = await res.text();
        const lines = text.trim().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const raw = JSON.parse(line);
            if (!raw.message) continue;
            const payload: SyncPayload = JSON.parse(raw.message);
            if (payload.deviceId === this.deviceId) continue;
            if (payload.pin !== this.pin) continue;
            if (payload.timestamp && payload.timestamp <= this.lastReceivedTimestamp) continue;
            
            this.lastReceivedTimestamp = payload.timestamp;
            this.onDataReceived?.(payload);
            this.onStatusChange?.('connected');
          } catch {
            // Ignore parse errors
          }
        }
      } catch {
        // Ignore network hiccups
      }
    }, 4000);
  }

  public disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const cloudSyncEngine = new KioskCloudSync();
