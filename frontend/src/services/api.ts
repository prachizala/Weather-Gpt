import {
  Location,
  WeatherSnapshot,
  ForecastData,
  AirQuality,
  ChatResponse,
  AdvisoriesReport,
  HistoricalComparisonResult,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export class WeatherApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async searchLocations(query: string, count: number = 5): Promise<Location[]> {
    if (!query.trim()) return [];
    const url = `${this.baseUrl}/api/locations/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Location search failed: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || json;
  }

  async getCurrentWeather(lat: number, lon: number, units: 'celsius' | 'fahrenheit' = 'celsius'): Promise<WeatherSnapshot> {
    const url = `${this.baseUrl}/api/weather/current?latitude=${lat}&longitude=${lon}&units=${units}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch current weather: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || json;
  }

  async getForecast(lat: number, lon: number, days: number = 7, units: 'celsius' | 'fahrenheit' = 'celsius'): Promise<ForecastData> {
    const url = `${this.baseUrl}/api/weather/forecast?latitude=${lat}&longitude=${lon}&days=${days}&units=${units}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch forecast: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || json;
  }

  async getAirQuality(lat: number, lon: number): Promise<AirQuality> {
    const url = `${this.baseUrl}/api/air-quality?latitude=${lat}&longitude=${lon}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch air quality: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || json;
  }

  async getAdvisories(
    lat: number,
    lon: number,
    units: 'celsius' | 'fahrenheit' = 'celsius',
    cityName?: string
  ): Promise<AdvisoriesReport> {
    let url = `${this.baseUrl}/api/advisories?latitude=${lat}&longitude=${lon}&units=${units}`;
    if (cityName) {
      url += `&city_name=${encodeURIComponent(cityName)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch advisories: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || json;
  }

  async getWeatherComparison(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
    yearsBack: number = 5,
    variable: string = 'precipitation_sum',
    units: 'celsius' | 'fahrenheit' = 'celsius',
    cityName?: string
  ): Promise<HistoricalComparisonResult> {
    let url = `${this.baseUrl}/api/weather/compare?latitude=${lat}&longitude=${lon}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&years_back=${yearsBack}&variable=${encodeURIComponent(variable)}&units=${units}`;
    if (cityName) {
      url += `&city_name=${encodeURIComponent(cityName)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch weather comparison: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || json;
  }

  async sendChatMessage(
    message: string,
    sessionId?: string,
    units: 'celsius' | 'fahrenheit' = 'celsius',
    location?: Location | null
  ): Promise<ChatResponse> {
    const url = `${this.baseUrl}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        units: { temperature: units },
        location: location || undefined
      })
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        detail = errJson.detail || errJson.message || detail;
      } catch (_) {}
      throw new Error(`Chat request failed: ${detail}`);
    }
    return res.json();
  }

  async streamChatMessage(
    message: string,
    sessionId: string | undefined,
    units: 'celsius' | 'fahrenheit',
    onToken: (token: string) => void,
    onMetadata?: (meta: Partial<ChatResponse>) => void,
    location?: Location | null
  ): Promise<void> {
    const url = `${this.baseUrl}/api/chat/stream`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        units: { temperature: units },
        location: location || undefined
      })
    });

    if (!res.ok) {
      throw new Error(`Chat stream failed: ${res.status} ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error('Readable stream not supported by browser environment.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;
        const lines = rawEvent.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.substring(6);
          }
        }

        if (eventType === 'done' || dataStr === '[DONE]') {
          return;
        } else if (eventType === 'metadata' && onMetadata) {
          try {
            const meta = JSON.parse(dataStr);
            onMetadata(meta);
          } catch (_) {}
        } else if (dataStr) {
          onToken(dataStr);
        }
      }
    }
  }
}

export const api = new WeatherApiClient();
