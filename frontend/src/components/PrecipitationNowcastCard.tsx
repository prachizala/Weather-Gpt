import React, { useState, useEffect, useRef } from 'react';
import { WeatherSnapshot, ForecastData } from '../types/api';

interface PrecipitationNowcastCardProps {
  weather?: WeatherSnapshot | null;
  forecast?: ForecastData | null;
  cityName?: string;
  units?: 'celsius' | 'fahrenheit';
  isLoading?: boolean;
  onAskAI?: (prompt: string) => void;
}

export const PrecipitationNowcastCard: React.FC<PrecipitationNowcastCardProps> = ({
  weather,
  forecast,
  cityName = 'Ahmedabad',
  units = 'celsius',
  isLoading = false,
  onAskAI,
}) => {
  const [radarRange, setRadarRange] = useState<15 | 30 | 60>(30);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const currentPrecip = weather?.precipitation ?? 0;
  const cloudCover = weather?.cloud_cover ?? 15;
  const windSpeed = weather?.wind_speed ?? 12;
  const windDir = weather?.wind_direction ?? 240;

  // Extract next 24-hr rain probability from forecast if available
  const hourlyPoints = forecast?.hourly?.slice(0, 7) || [];
  const currentRainProb = hourlyPoints[0]?.precipitation_probability ?? Math.min(100, Math.round(cloudCover * 0.4 + currentPrecip * 30));

  // Generate 60-minute simulation intervals (every 10 mins: 0, 10, 20, 30, 40, 50, 60)
  const minutelyBuckets = [0, 10, 20, 30, 40, 50, 60].map((minute, idx) => {
    // Dynamic rain intensity estimate (mm/hr)
    let intensity = currentPrecip;
    if (intensity === 0 && currentRainProb > 30) {
      intensity = (currentRainProb / 100) * 0.8 * Math.sin((minute / 60) * Math.PI);
    } else {
      intensity = Math.max(0, currentPrecip + (Math.sin(minute + idx) * 0.15));
    }

    return {
      minute,
      timeLabel: minute === 0 ? 'Now' : `+${minute}m`,
      intensity: Number(intensity.toFixed(2)),
      level:
        intensity <= 0.05
          ? 'none'
          : intensity <= 1.0
          ? 'light'
          : intensity <= 3.5
          ? 'moderate'
          : 'heavy',
    };
  });

  const isRainingNow = currentPrecip > 0.1;
  const willRainSoon = minutelyBuckets.some((b) => b.intensity > 0.1);

  // Animated Circular Doppler Radar Sweep
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let sweepAngle = 0;

    // Simulated storm precipitation cells placed in canvas relative coordinates
    const echoCells = [
      { rRatio: 0.35, angle: (windDir + 40) * (Math.PI / 180), intensity: currentRainProb > 40 ? 45 : 18 },
      { rRatio: 0.65, angle: (windDir - 30) * (Math.PI / 180), intensity: currentRainProb > 60 ? 55 : 22 },
      { rRatio: 0.8, angle: (windDir + 120) * (Math.PI / 180), intensity: currentRainProb > 25 ? 30 : 12 },
    ];

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = (Math.min(w, h) / 2) - 10;

      ctx.clearRect(0, 0, w, h);

      // Radar background circles (Range Rings)
      const ringSteps = [0.33, 0.66, 1.0];
      ringSteps.forEach((step, idx) => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxRadius * step, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Range labels
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.font = '9px monospace';
        const distKm = Math.round((radarRange * step));
        ctx.fillText(`${distKm}km`, cx + 4, cy - (maxRadius * step) + 10);
      });

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cardinal direction letters
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', cx, cy - maxRadius + 8);
      ctx.fillText('S', cx, cy + maxRadius - 2);
      ctx.fillText('E', cx + maxRadius - 6, cy + 3);
      ctx.fillText('W', cx - maxRadius + 6, cy + 3);

      // Render Doppler reflectivity echoes
      echoCells.forEach((echo) => {
        const echoDist = maxRadius * echo.rRatio;
        const ex = cx + Math.cos(echo.angle) * echoDist;
        const ey = cy + Math.sin(echo.angle) * echoDist;

        const radGradient = ctx.createRadialGradient(ex, ey, 2, ex, ey, 24);
        if (echo.intensity > 40) {
          // Strong precipitation / storm cell
          radGradient.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
          radGradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
          radGradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else if (echo.intensity > 20) {
          // Moderate rain shower
          radGradient.addColorStop(0, 'rgba(16, 185, 129, 0.6)');
          radGradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.3)');
          radGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
        } else {
          // Light drizzle / cloud reflection
          radGradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
          radGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
        }

        ctx.fillStyle = radGradient;
        ctx.beginPath();
        ctx.arc(ex, ey, 24, 0, Math.PI * 2);
        ctx.fill();
      });

      // Animated rotating radar sweep beam (PPI Sector)
      const beamSpread = 0.45; // radians (~25 degrees)
      const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
      sweepGradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      sweepGradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, sweepAngle - beamSpread, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweepGradient;
      ctx.fill();

      // Leading beam edge line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();

      // Center Station Marker (Pulse)
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38BDF8';
      ctx.fill();

      // Increment sweep angle
      sweepAngle = (sweepAngle + 0.035) % (Math.PI * 2);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [radarRange, windDir, currentRainProb]);

  if (isLoading) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(17, 27, 46, 0.95), rgba(11, 18, 32, 0.98))',
          border: '1px solid #1E2A44',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          minHeight: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94A3B8',
          fontSize: '13px',
        }}
      >
        Initializing Micro-Doppler Precipitation Sweep...
      </div>
    );
  }

  const promptText = `Will there be any rain or precipitation in ${cityName} during the next few hours? Please analyze Doppler radar and minutely precipitation trends.`;

  return (
    <section
      aria-label="Hyper-Local Minutely Precipitation & Doppler Nowcast Simulator"
      style={{
        background: 'linear-gradient(135deg, rgba(17, 27, 46, 0.95), rgba(11, 18, 32, 0.98))',
        border: '1px solid #1E2A44',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>📡</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.01em',
              }}
            >
              Hyper-Local Minutely Rain & Doppler Radar
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              Next 60 Min Nowcast
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Minute-by-minute atmospheric moisture progression and synthetic Plan Position Indicator (PPI) radar sweep.
          </p>
        </div>

        {/* Live Radar Range Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: '#64748B', marginRight: '4px' }}>Sweep Radius:</span>
          {([15, 30, 60] as const).map((km) => (
            <button
              key={km}
              onClick={() => setRadarRange(km)}
              style={{
                background: radarRange === km ? 'rgba(56, 189, 248, 0.2)' : 'rgba(17, 27, 46, 0.6)',
                border: radarRange === km ? '1px solid #38BDF8' : '1px solid #1E2A44',
                color: radarRange === km ? '#38BDF8' : '#94A3B8',
                fontSize: '11px',
                fontWeight: radarRange === km ? 700 : 500,
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {km}km
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Minutely Timeline + Right Circular Doppler Canvas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px',
          alignItems: 'center',
        }}
      >
        {/* Left Column: 60-Minute Precipitation Timeline */}
        <div>
          {/* Status Alert Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              background: isRainingNow
                ? 'rgba(56, 189, 248, 0.15)'
                : willRainSoon
                ? 'rgba(251, 191, 36, 0.12)'
                : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${
                isRainingNow
                  ? 'rgba(56, 189, 248, 0.3)'
                  : willRainSoon
                  ? 'rgba(251, 191, 36, 0.3)'
                  : 'rgba(16, 185, 129, 0.25)'
              }`,
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '18px' }}>
              {isRainingNow ? '🌧️' : willRainSoon ? '🌦️' : '☀️'}
            </span>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: isRainingNow ? '#38BDF8' : willRainSoon ? '#FBBF24' : '#10B981',
                }}
              >
                {isRainingNow
                  ? `Active Precipitation (${currentPrecip.toFixed(1)} mm/hr)`
                  : willRainSoon
                  ? 'Isolated Moisture Bands Expected in ~25-40 min'
                  : 'Zero Precipitation Expected for Next 60+ Minutes'}
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                {isRainingNow
                  ? 'Carry umbrella · Roads may experience reduced braking friction'
                  : willRainSoon
                  ? 'Keep light rain protection ready if traveling outdoors'
                  : 'Completely clear skies · Safe for cycling, walking & outdoor sports'}
              </div>
            </div>
          </div>

          {/* Minutely Bar Chart */}
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#94A3B8',
                marginBottom: '8px',
              }}
            >
              <span>Precipitation Volume Progression (mm/hr)</span>
              <span style={{ color: '#38BDF8', fontWeight: 600 }}>Rain Prob: {currentRainProb}%</span>
            </div>

            {/* Custom 7-bucket minute column bars */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '75px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #1E2A44',
                borderRadius: '8px',
                padding: '8px 12px 6px',
                gap: '8px',
              }}
            >
              {minutelyBuckets.map((bucket, i) => {
                // Max height mapping (scale 0 to 4mm/hr)
                const heightPercent = Math.min(100, Math.max(12, Math.round((bucket.intensity / 3) * 100)));
                const barColor =
                  bucket.level === 'heavy'
                    ? '#EF4444'
                    : bucket.level === 'moderate'
                    ? '#FBBF24'
                    : bucket.level === 'light'
                    ? '#38BDF8'
                    : 'rgba(56, 189, 248, 0.18)';

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '22px',
                        height: `${heightPercent}%`,
                        background: barColor,
                        borderRadius: '3px 3px 0 0',
                        transition: 'all 0.3s ease',
                        boxShadow: bucket.intensity > 0.1 ? `0 0 8px ${barColor}` : 'none',
                      }}
                      title={`${bucket.timeLabel}: ${bucket.intensity} mm/hr`}
                    />
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#64748B',
                        marginTop: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {bucket.timeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-Metric Diagnostic Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div
              style={{
                background: 'rgba(17, 27, 46, 0.7)',
                border: '1px solid #1E2A44',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Atmospheric Cloud Deck
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                {cloudCover}% Coverage
              </div>
            </div>

            <div
              style={{
                background: 'rgba(17, 27, 46, 0.7)',
                border: '1px solid #1E2A44',
                borderRadius: '8px',
                padding: '8px 10px',
              }}
            >
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                Echo Steering Wind
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#FBBF24', marginTop: '2px' }}>
                {windSpeed} km/h · {windDir}°
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Circular Plan Position Indicator (PPI) Radar Canvas */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '210px',
              height: '210px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(17, 27, 46, 0.9) 0%, rgba(11, 18, 32, 1) 100%)',
              border: '2px solid #1E2A44',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.1)',
              overflow: 'hidden',
            }}
          >
            <canvas
              ref={canvasRef}
              width={210}
              height={210}
              style={{ display: 'block' }}
            />
          </div>

          {/* Radar Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '10px',
              fontSize: '10.5px',
              color: '#94A3B8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8' }} />
              <span>Light (&lt;1mm)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <span>Moderate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
              <span>Heavy (&gt;3mm)</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Consultation Prompt Bar */}
      {onAskAI && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
            Want AI analysis on cloud trajectory and rainfall timing?
          </span>
          <button
            onClick={() => onAskAI(promptText)}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#38BDF8',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
              e.currentTarget.style.borderColor = '#38BDF8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
            }}
          >
            <span>Ask WeatherGPT: "Will it rain in {cityName}?"</span>
            <span>→</span>
          </button>
        </div>
      )}
    </section>
  );
};
