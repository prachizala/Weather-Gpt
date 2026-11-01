import React, { useEffect, useRef } from 'react';
import { AirQuality } from '../types/api';

interface AirQualityCardProps {
  airQuality: AirQuality | null;
  isLoading: boolean;
}

function getAqiMeta(val: number): { label: string; color: string; badgeClass: string } {
  if (val <= 50)  return { label: 'Good',                 color: 'var(--success)', badgeClass: 'badge-success' };
  if (val <= 100) return { label: 'Moderate',             color: 'var(--warning)', badgeClass: 'badge-warning' };
  if (val <= 150) return { label: 'Sensitive',            color: 'var(--warning)', badgeClass: 'badge-warning' };
  if (val <= 200) return { label: 'Unhealthy',            color: 'var(--danger)',  badgeClass: 'badge-danger' };
  if (val <= 300) return { label: 'Very Unhealthy',       color: 'var(--danger)',  badgeClass: 'badge-danger' };
  return           { label: 'Hazardous',                  color: 'var(--danger)',  badgeClass: 'badge-danger' };
}

const CircularGauge: React.FC<{ value: number; max?: number; color: string; size?: number }> = ({
  value, max = 300, color, size = 110
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value, 0) / max, 1);
  const offset = circumference * (1 - pct);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (arcRef.current) {
      arcRef.current.style.strokeDashoffset = String(circumference);
      arcRef.current.getBoundingClientRect();
      arcRef.current.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
      arcRef.current.style.strokeDashoffset = String(offset);
    }
  }, [offset, circumference]);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
      {/* Fill arc */}
      <circle
        ref={arcRef}
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={String(circumference)}
        strokeDashoffset={String(circumference)}
        transform="rotate(-90 50 50)"
      />
      {/* Value label */}
      <text
        x="50"
        y="46"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text)"
        fontSize="18"
        fontWeight="700"
      >
        {Math.round(value)}
      </text>
      <text
        x="50"
        y="62"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--muted)"
        fontSize="9"
        fontWeight="600"
      >
        AQI
      </text>
    </svg>
  );
};

export const AirQualityCard: React.FC<AirQualityCardProps> = ({ airQuality, isLoading }) => {
  if (isLoading) {
    return (
      <div
        className="skeleton"
        style={{
          height: '150px',
          borderRadius: '16px',
          marginBottom: '24px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      />
    );
  }
  if (!airQuality) return null;

  const aqiVal = airQuality.us_aqi ?? airQuality.aqi ?? 0;
  const meta = getAqiMeta(aqiVal);

  const pollutants = [
    { label: 'PM2.5', value: airQuality.pm2_5, unit: 'μg/m³', icon: '🔴' },
    { label: 'PM10',  value: airQuality.pm10,  unit: 'μg/m³', icon: '🟠' },
    { label: 'O₃',   value: airQuality.ozone,  unit: 'μg/m³', icon: '🟡' },
    { label: 'UV',   value: airQuality.uv_index, unit: 'idx', icon: '☀️' },
  ];

  return (
    <div
      style={{
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        {/* Circular gauge */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CircularGauge value={aqiVal} max={300} color={meta.color} size={100} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>
              Air Quality Index
            </h4>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: '700',
                border: `1px solid ${meta.color}`,
                color: meta.color,
                backgroundColor: 'rgba(255,255,255,0.04)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {meta.label}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {pollutants.map((p) => (
              <div
                key={p.label}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>
                  {p.icon} {p.label}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>
                  {p.value !== undefined ? p.value.toFixed(1) : '--'}
                  <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '400', marginLeft: '3px' }}>
                    {p.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
