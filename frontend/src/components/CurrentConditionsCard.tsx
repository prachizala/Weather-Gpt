import React from 'react';
import { WeatherSnapshot, Location } from '../types/api';

interface CurrentConditionsCardProps {
  location: Location | null;
  weather: WeatherSnapshot | null;
  units: 'celsius' | 'fahrenheit';
  onToggleUnits: () => void;
  isLoading: boolean;
}

const WMO_DESCRIPTIONS: Record<number, { label: string; emoji: string }> = {
  0: { label: 'Clear Sky', emoji: '☀️' },
  1: { label: 'Mainly Clear', emoji: '🌤️' },
  2: { label: 'Partly Cloudy', emoji: '⛅' },
  3: { label: 'Overcast', emoji: '☁️' },
  45: { label: 'Foggy', emoji: '🌫️' },
  48: { label: 'Icy Fog', emoji: '🌫️' },
  51: { label: 'Light Drizzle', emoji: '🌦️' },
  53: { label: 'Drizzle', emoji: '🌦️' },
  55: { label: 'Heavy Drizzle', emoji: '🌧️' },
  61: { label: 'Light Rain', emoji: '🌧️' },
  63: { label: 'Moderate Rain', emoji: '🌧️' },
  65: { label: 'Heavy Rain', emoji: '🌧️' },
  71: { label: 'Light Snow', emoji: '🌨️' },
  73: { label: 'Moderate Snow', emoji: '❄️' },
  75: { label: 'Heavy Snow', emoji: '❄️' },
  80: { label: 'Rain Showers', emoji: '🌦️' },
  81: { label: 'Heavy Showers', emoji: '🌧️' },
  82: { label: 'Violent Showers', emoji: '⛈️' },
  95: { label: 'Thunderstorm', emoji: '⛈️' },
  96: { label: 'Hail Storm', emoji: '⛈️' },
  99: { label: 'Heavy Hail Storm', emoji: '⛈️' },
};

function getWeatherInfo(code: number | undefined, isDay?: number) {
  if (code === undefined) return { label: 'Unknown', emoji: '🌡️' };
  const currentHour = new Date().getHours();
  const isNight = isDay === 0 || (isDay === undefined && (currentHour >= 18 || currentHour < 6)) || currentHour >= 18 || currentHour < 6;

  const exact = WMO_DESCRIPTIONS[code];
  let label = exact ? exact.label : 'Unknown';
  let emoji = exact ? exact.emoji : '🌡️';

  if (!exact) {
    const keys = Object.keys(WMO_DESCRIPTIONS).map(Number).sort((a, b) => b - a);
    const lower = keys.find(k => k <= code);
    if (lower !== undefined) {
      label = WMO_DESCRIPTIONS[lower].label;
      emoji = WMO_DESCRIPTIONS[lower].emoji;
    }
  }

  // Use night icons when appropriate
  if (isNight) {
    if (code === 0) return { label: 'Clear Sky', emoji: '🌙' };
    if (code === 1) return { label: 'Mainly Clear', emoji: '🌙' };
    if (code === 2) return { label: 'Partly Cloudy', emoji: '☁️' };
  }

  return { label, emoji };
}

export const CurrentConditionsCard: React.FC<CurrentConditionsCardProps> = ({
  location, weather, units, onToggleUnits, isLoading
}) => {
  if (isLoading) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '240px', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (!weather || !location) {
    return (
      <div style={{
        padding: '36px',
        borderRadius: '16px',
        textAlign: 'center',
        color: 'var(--muted)',
        marginBottom: '24px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>🌍</div>
        <p style={{ fontSize: '15px', color: 'var(--text)' }}>Search a city to view live conditions</p>
      </div>
    );
  }

  const tempSymbol = units === 'celsius' ? '°C' : '°F';
  const speedUnit = units === 'celsius' ? 'km/h' : 'mph';
  const { label: wLabel, emoji: wEmoji } = getWeatherInfo(weather.weather_code, weather.is_day);

  const formatLocalTime = (tz?: string) => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: tz || 'UTC', hour: '2-digit', minute: '2-digit',
        weekday: 'short', month: 'short', day: 'numeric',
      }).format(new Date());
    } catch { return new Date().toLocaleString(); }
  };

  const metrics = [
    { label: 'Feels Like', value: `${weather.apparent_temperature?.toFixed(1) ?? '--'}${tempSymbol}`, icon: '🌡️' },
    { label: 'Humidity', value: `${weather.relative_humidity ?? '--'}%`, icon: '💧' },
    { label: 'Wind', value: `${weather.wind_speed?.toFixed(1) ?? '--'} ${speedUnit}`, icon: '💨' },
    { label: 'Pressure', value: `${weather.surface_pressure?.toFixed(0) ?? '--'} hPa`, icon: '🔵' },
  ];

  return (
    <article
      aria-label={`Current meteorological conditions for ${location.name}`}
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '24px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Top section: big temp + location */}
      <div style={{
        padding: '28px 28px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', flexWrap: 'wrap', gap: '20px',
        justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        {/* Left: temperature */}
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ fontSize: '64px', lineHeight: 1 }}>
              {wEmoji}
            </div>
            <div>
              <div style={{
                fontSize: '64px',
                fontWeight: '800',
                lineHeight: 1,
                color: 'var(--accent)',
                letterSpacing: '-2px',
              }}>
                {weather.temperature.toFixed(1)}<span style={{ fontSize: '32px', fontWeight: '600', letterSpacing: '-1px' }}>{tempSymbol}</span>
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', marginTop: '6px', fontWeight: '500' }}>
                {wLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Right: location + time + toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2 }}>
              {location.name}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '3px' }}>
              {[location.admin1, location.country].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              🕐 {formatLocalTime(location.timezone)}
            </div>
          </div>

          {/* Units toggle */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '3px',
            backgroundColor: 'var(--bg)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
          }}>
            <button
              className={`unit-btn ${units === 'celsius' ? 'unit-btn-active' : 'unit-btn-inactive'}`}
              onClick={() => units !== 'celsius' && onToggleUnits()}
              aria-label="Switch to Celsius"
            >°C</button>
            <button
              className={`unit-btn ${units === 'fahrenheit' ? 'unit-btn-active' : 'unit-btn-inactive'}`}
              onClick={() => units !== 'fahrenheit' && onToggleUnits()}
              aria-label="Switch to Fahrenheit"
            >°F</button>
          </div>
        </div>
      </div>

      {/* Bottom section: metric pills */}
      <div style={{
        padding: '20px 28px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
      }}>
        {metrics.map((m) => (
          <div key={m.label} className="metric-card" style={{
            padding: '14px 16px',
            backgroundColor: 'var(--bg)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{m.icon}</span> {m.label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Attribution footer */}
      <div style={{
        padding: '10px 28px 14px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '11px', color: 'var(--muted)',
      }}>
        <span>
          Data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
            Open-Meteo.com
          </a> (CC BY 4.0)
        </span>
        <span>Updated {new Date(weather.retrieved_at).toLocaleTimeString()}</span>
      </div>
    </article>
  );
};
