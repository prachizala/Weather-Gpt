import React from 'react';
import { ForecastData } from '../types/api';

interface ForecastCardsProps {
  forecast: ForecastData | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
}

const WMO_EMOJI: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function getEmoji(code: number): string {
  if (WMO_EMOJI[code]) return WMO_EMOJI[code];
  const keys = Object.keys(WMO_EMOJI).map(Number).sort((a, b) => b - a);
  const lower = keys.find(k => k <= code);
  return lower !== undefined ? WMO_EMOJI[lower] : '🌡️';
}

export const ForecastCards: React.FC<ForecastCardsProps> = ({ forecast, units, isLoading }) => {
  if (isLoading) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)', marginBottom: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          7-Day Forecast
        </div>
        <div className="h-scroll">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton" style={{ minWidth: '110px', height: '160px', borderRadius: '16px', flexShrink: 0, backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!forecast?.daily?.length) return null;

  const tempSymbol = units === 'celsius' ? '°C' : '°F';

  const getDayName = (dateStr: string, idx: number) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      if (idx === 0) return 'Today';
      if (idx === 1) return 'Tomorrow';
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    } catch { return dateStr; }
  };

  const getDayDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          7-Day Weather Forecast
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Open-Meteo CC BY 4.0</span>
      </div>

      <div className="h-scroll stagger">
        {forecast.daily.slice(0, 7).map((day, idx) => {
          const maxT = day.temperature_max;
          const minT = day.temperature_min;
          const precipProb = day.precipitation_probability_max ?? 0;
          const isToday = idx === 0;

          return (
            <div
              key={day.date}
              className="forecast-item"
              style={{
                minWidth: '112px',
                flexShrink: 0,
                borderRadius: '16px',
                padding: '16px 12px',
                textAlign: 'center',
                backgroundColor: 'var(--surface)',
                border: isToday ? '1px solid var(--primary)' : '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: isToday ? 'var(--primary)' : 'var(--muted)',
                  marginBottom: '2px',
                }}
              >
                {getDayName(day.date, idx)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
                {getDayDate(day.date)}
              </div>

              <div style={{ fontSize: '32px', lineHeight: 1, marginBottom: '8px' }}>
                {getEmoji(day.weather_code ?? 0)}
              </div>

              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
                {maxT !== undefined ? `${maxT.toFixed(0)}${tempSymbol}` : '--'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
                {minT !== undefined ? `${minT.toFixed(0)}${tempSymbol}` : '--'}
              </div>

              {/* Precipitation probability bar */}
              <div title={`${precipProb}% precipitation probability`}>
                <div style={{ height: '3px', borderRadius: '2px', backgroundColor: 'var(--border)', overflow: 'hidden', marginBottom: '4px' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: '2px',
                      width: `${precipProb}%`,
                      backgroundColor: precipProb >= 40 ? 'var(--primary)' : 'var(--muted)',
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', color: precipProb >= 40 ? 'var(--primary)' : 'var(--muted)' }}>
                  {precipProb}% 🌧
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
