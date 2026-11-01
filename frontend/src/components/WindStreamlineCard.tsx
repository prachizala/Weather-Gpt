import React, { useRef, useEffect, useState } from 'react';
import { WeatherSnapshot, Location } from '../types/api';
import {
  Wind,
  Compass,
  Gauge,
  Navigation2,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';

interface WindStreamlineCardProps {
  location: Location | null;
  weather: WeatherSnapshot | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
}

interface Particle {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const BEAUFORT_SCALE: { maxSpeedKmh: number; name: string; description: string; effect: string }[] = [
  { maxSpeedKmh: 1, name: 'Calm', description: 'Smoke rises vertically', effect: 'No noticeable air movement' },
  { maxSpeedKmh: 5, name: 'Light Air', description: 'Smoke drift indicates wind direction', effect: 'Leaves barely whisper' },
  { maxSpeedKmh: 11, name: 'Light Breeze', description: 'Wind felt on exposed skin; leaves rustle', effect: 'Ideal for outdoor dining' },
  { maxSpeedKmh: 19, name: 'Gentle Breeze', description: 'Leaves & small twigs in constant motion', effect: 'Pleasant cooling breeze' },
  { maxSpeedKmh: 28, name: 'Moderate Breeze', description: 'Dust and loose paper raised; small branches move', effect: 'Slight drag when cycling' },
  { maxSpeedKmh: 38, name: 'Fresh Breeze', description: 'Small trees in leaf begin to sway', effect: 'Umbrellas difficult to use' },
  { maxSpeedKmh: 49, name: 'Strong Breeze', description: 'Large branches in motion; whistling in wires', effect: 'Walking against wind requires effort' },
  { maxSpeedKmh: 61, name: 'Near Gale', description: 'Whole trees in motion; resistance felt walking', effect: 'Outdoor events should secure setups' },
  { maxSpeedKmh: 74, name: 'Gale', description: 'Twigs break off trees; progress impeded', effect: 'Structural disruption risk' },
  { maxSpeedKmh: 120, name: 'Storm', description: 'Widespread damage occurs', effect: 'High hazard warning' },
];

function getBeaufort(speedKmh: number) {
  for (const b of BEAUFORT_SCALE) {
    if (speedKmh <= b.maxSpeedKmh) return b;
  }
  return BEAUFORT_SCALE[BEAUFORT_SCALE.length - 1];
}

function getCardinalDirection(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

export const WindStreamlineCard: React.FC<WindStreamlineCardProps> = ({
  location,
  weather,
  units,
  isLoading,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamlineMode, setStreamlineMode] = useState<'normal' | 'dense' | 'vortex'>('normal');

  const speedKmh = weather?.wind_speed ?? 12;
  const windDirDeg = weather?.wind_direction ?? 45;
  const cardinal = getCardinalDirection(windDirDeg);
  const beaufort = getBeaufort(speedKmh);
  const speedUnit = units === 'celsius' ? 'km/h' : 'mph';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = 180);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = 180;
      }
    };
    window.addEventListener('resize', handleResize);

    // Radians angle of wind travel
    // In meteorology, wind direction degrees is WHERE THE WIND IS COMING FROM.
    // Particle movement is in the direction wind is blowing TO (deg + 180).
    const rad = ((windDirDeg + 180) % 360) * (Math.PI / 180);
    const vx = Math.cos(rad);
    const vy = Math.sin(rad);

    // Number of particles
    const particleCount = streamlineMode === 'dense' ? 95 : streamlineMode === 'vortex' ? 80 : 55;
    const baseSpeed = Math.max(0.8, Math.min(speedKmh / 6, 6));

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 24 + 16,
        speed: baseSpeed * (0.8 + Math.random() * 0.4),
        opacity: Math.random() * 0.6 + 0.2,
        life: Math.random() * 100,
        maxLife: Math.random() * 80 + 70,
      });
    }

    const render = () => {
      // Semi-transparent trailing clear for smooth particle streaks
      ctx.fillStyle = 'rgba(11, 18, 32, 0.28)';
      ctx.fillRect(0, 0, width, height);

      // Render vector flow particles
      particles.forEach((p) => {
        p.life++;
        if (p.life > p.maxLife) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.life = 0;
        }

        // Move along wind vector
        let moveX = vx;
        let moveY = vy;

        if (streamlineMode === 'vortex') {
          // Add subtle atmospheric swirl curve
          const cx = width / 2;
          const cy = height / 2;
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const curl = 0.4;
          moveX = vx * 0.7 - (dy / (dist + 20)) * curl;
          moveY = vy * 0.7 + (dx / (dist + 20)) * curl;
        }

        p.x += moveX * p.speed;
        p.y += moveY * p.speed;

        // Wrap around boundaries
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Calculate opacity based on lifetime curve
        const lifeRatio = p.life / p.maxLife;
        const currentAlpha = Math.sin(lifeRatio * Math.PI) * p.opacity;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - moveX * p.length, p.y - moveY * p.length);
        ctx.strokeStyle = `rgba(56, 189, 248, ${currentAlpha})`;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Small bright particle head
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(229, 237, 247, ${currentAlpha * 1.2})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [windDirDeg, speedKmh, streamlineMode]);

  if (isLoading || !weather) return null;

  return (
    <section
      aria-label="Micro-Climate Wind Vector and Atmospheric Streamline Radar"
      style={{
        borderRadius: '16px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        marginBottom: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Wind style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
                Atmospheric Wind & Vector Streamlines
              </h2>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--primary)',
                  letterSpacing: '0.04em',
                }}
              >
                LIVE VECTORS
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Real-time particle kinematics & Beaufort aerodynamic scale in {location?.name ?? 'your city'}
            </p>
          </div>
        </div>

        {/* Streamline flow mode toggles */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            padding: '2px',
          }}
        >
          {(['normal', 'dense', 'vortex'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setStreamlineMode(m)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: streamlineMode === m ? 'var(--primary)' : 'transparent',
                color: streamlineMode === m ? '#0B1220' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Streamline Canvas Box */}
      <div
        style={{
          position: 'relative',
          borderRadius: '12px',
          backgroundColor: '#0B1220',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          marginBottom: '14px',
          height: '180px',
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* Live Compass Overlay in top right of canvas */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(17, 27, 46, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(${windDirDeg}deg)`,
              transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Navigation2 style={{ width: 14, height: 14, color: 'var(--accent)', fill: 'var(--accent)' }} />
          </div>

          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text)', display: 'block', lineHeight: 1 }}>
              {cardinal} ({windDirDeg}°)
            </span>
            <span style={{ fontSize: '9px', color: 'var(--muted)' }}>
              Direction
            </span>
          </div>
        </div>

        {/* Live Speed Overlay in top left */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            backgroundColor: 'rgba(17, 27, 46, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          <Gauge style={{ width: 16, height: 16, color: 'var(--primary)' }} />
          <div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', display: 'block', lineHeight: 1 }}>
              {speedKmh.toFixed(1)} <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>{speedUnit}</span>
            </span>
            <span style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 700 }}>
              {beaufort.name}
            </span>
          </div>
        </div>
      </div>

      {/* Aerodynamic Analysis Card */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          fontSize: '11.5px',
        }}
      >
        <div>
          <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Beaufort Rating:</span>
          <strong style={{ color: 'var(--text)' }}>Force {BEAUFORT_SCALE.findIndex((b) => b.name === beaufort.name)} ({beaufort.name})</strong>
        </div>
        <div>
          <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Visible Environmental Effect:</span>
          <span style={{ color: 'var(--text)' }}>{beaufort.description}</span>
        </div>
        <div>
          <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>Outdoor Life Impact:</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{beaufort.effect}</span>
        </div>
      </div>
    </section>
  );
};
