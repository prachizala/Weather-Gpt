import React, { useMemo } from 'react';

export interface WeatherBackgroundProps {
  weatherCode: number | null;
  isDay: number;
  windSpeed?: number;
  timezone?: string;
  forceMode?: 'auto' | 'morning' | 'day' | 'sunset' | 'night' | 'rain' | 'wind' | 'storm';
}

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

const WeatherBackground: React.FC<WeatherBackgroundProps> = ({
  weatherCode,
  isDay,
  windSpeed = 0,
  timezone,
  forceMode = 'auto',
}) => {
  // Determine effective time of day (morning / day / sunset / night)
  const timeOfDay: TimeOfDay = useMemo(() => {
    if (forceMode === 'morning') return 'morning';
    if (forceMode === 'day' || forceMode === 'rain' || forceMode === 'wind') return 'day';
    if (forceMode === 'sunset') return 'sunset';
    if (forceMode === 'night' || forceMode === 'storm') return 'night';

    // Auto mode based on isDay and current hour
    if (isDay === 0) return 'night';

    let hour = new Date().getHours();
    if (timezone) {
      try {
        const timeStr = new Date().toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour12: false,
          hour: 'numeric',
        });
        const parsed = parseInt(timeStr, 10);
        if (!isNaN(parsed)) hour = parsed;
      } catch {
        // Fallback to local machine hour
      }
    }

    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'day';
    if (hour >= 17 && hour < 19) return 'sunset';
    return 'night';
  }, [forceMode, isDay, timezone]);

  // Determine weather conditions
  const isRaining = useMemo(() => {
    if (forceMode === 'rain' || forceMode === 'storm') return true;
    if (weatherCode === null || weatherCode === undefined) return false;
    return (
      (weatherCode >= 51 && weatherCode <= 67) ||
      (weatherCode >= 80 && weatherCode <= 82) ||
      weatherCode >= 95
    );
  }, [forceMode, weatherCode]);

  const isStorm = useMemo(() => {
    if (forceMode === 'storm') return true;
    if (weatherCode === null || weatherCode === undefined) return false;
    return weatherCode >= 95;
  }, [forceMode, weatherCode]);

  const isWindy = useMemo(() => {
    if (forceMode === 'wind' || forceMode === 'storm') return true;
    return windSpeed >= 12;
  }, [forceMode, windSpeed]);

  const isSnowing = useMemo(() => {
    if (weatherCode === null || weatherCode === undefined) return false;
    return (weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86;
  }, [weatherCode]);

  const isCloudy = useMemo(() => {
    if (weatherCode === null || weatherCode === undefined) return false;
    return (
      (weatherCode >= 1 && weatherCode <= 3) ||
      (weatherCode >= 45 && weatherCode <= 48) ||
      isRaining ||
      isStorm
    );
  }, [weatherCode, isRaining, isStorm]);

  const isNightSkyActive = timeOfDay === 'night';
  const isSunActive = timeOfDay === 'morning' || timeOfDay === 'day' || timeOfDay === 'sunset';

  // 110 Stars for Night Sky (चाँद-तारे)
  const stars = useMemo(() => {
    return Array.from({ length: 110 }, (_, i) => {
      const top = ((i * 19 + 3) % 96) + (i % 3) * 0.8;
      const left = ((i * 31 + 7) % 98) + (i % 4) * 0.5;
      const size = i % 8 === 0 ? 3.5 : i % 3 === 0 ? 2.5 : 1.5;
      const isSparkle = i % 5 === 0;
      const duration = 2.0 + (i % 5) * 0.8;
      const delay = (i % 7) * 0.5;

      return {
        id: i,
        top: `${top}%`,
        left: `${left}%`,
        size,
        isSparkle,
        duration,
        delay,
      };
    });
  }, []);

  // 20 Sparkling 4-point cross stars (✨)
  const crossStars = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      top: `${(i * 17 + 8) % 90}%`,
      left: `${(i * 29 + 5) % 96}%`,
      size: 11 + (i % 3) * 4,
      duration: 2.8 + (i % 4) * 1.2,
      delay: i * 0.6,
    }));
  }, []);

  // Rain drops (बारिश)
  const rainDrops = useMemo(() => {
    if (!isRaining) return [];
    return Array.from({ length: isStorm ? 90 : 65 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      duration: isStorm ? 0.45 + Math.random() * 0.4 : 0.65 + Math.random() * 0.7,
      delay: Math.random() * 2,
      height: isStorm ? 20 + Math.random() * 25 : 12 + Math.random() * 18,
      opacity: 0.25 + Math.random() * 0.4,
    }));
  }, [isRaining, isStorm]);

  // Wind flow streaks (हवा)
  const windStreaks = useMemo(() => {
    if (!isWindy) return [];
    return Array.from({ length: isStorm ? 16 : 10 }, (_, i) => ({
      id: i,
      top: 10 + (i * 8) % 80,
      width: 140 + (i % 4) * 80,
      duration: isStorm ? 2.2 + (i % 3) * 0.8 : 3.5 + (i % 4) * 1.2,
      delay: (i * 0.5) % 3,
      opacity: 0.3 + (i % 3) * 0.15,
    }));
  }, [isWindy, isStorm]);

  // Snowflakes (बर्फ)
  const snowFlakes = useMemo(() => {
    if (!isSnowing) return [];
    return Array.from({ length: 45 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 4 + Math.random() * 6,
      duration: 3.5 + Math.random() * 4,
      delay: Math.random() * 3,
      opacity: 0.4 + Math.random() * 0.5,
    }));
  }, [isSnowing]);

  // Background radial atmospheric gradient based on time and weather
  const backgroundRadial = useMemo(() => {
    if (isStorm) {
      return 'radial-gradient(circle at 50% 0%, rgba(30, 42, 68, 0.6) 0%, rgba(15, 23, 42, 0.9) 60%, transparent 100%)';
    }
    if (timeOfDay === 'morning') {
      return 'radial-gradient(circle at 85% 15%, rgba(251, 191, 36, 0.16) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 75%)';
    }
    if (timeOfDay === 'day') {
      return 'radial-gradient(circle at 85% 10%, rgba(56, 189, 248, 0.18) 0%, rgba(251, 191, 36, 0.08) 35%, transparent 75%)';
    }
    if (timeOfDay === 'sunset') {
      return 'radial-gradient(circle at 85% 25%, rgba(245, 158, 11, 0.20) 0%, rgba(248, 113, 113, 0.12) 35%, transparent 75%)';
    }
    // Night
    return 'radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.08) 0%, transparent 70%)';
  }, [timeOfDay, isStorm]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundColor: 'var(--bg)',
        backgroundImage: backgroundRadial,
        overflow: 'hidden',
        pointerEvents: 'none',
        transition: 'background-image 1.5s ease',
      }}
    >
      {/* ── LIGHTNING FLASH OVERLAY (तूफ़ान / बिजली) ────────────────── */}
      {isStorm && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            animation: 'lightningFlash 7s infinite',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}

      {/* ── CLOUD LAYERS (बादल) ────────────────────────────────────── */}
      {isCloudy && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '8%',
              width: '420px',
              height: '110px',
              opacity: isStorm ? 0.35 : 0.18,
              animation: 'cloudDrift 65s linear infinite',
              filter: 'blur(16px)',
              background: 'radial-gradient(ellipse at center, rgba(147, 197, 253, 0.45) 0%, transparent 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '18%',
              width: '560px',
              height: '140px',
              opacity: isStorm ? 0.4 : 0.14,
              animation: 'cloudDrift 95s linear 15s infinite',
              filter: 'blur(22px)',
              background: 'radial-gradient(ellipse at center, rgba(186, 230, 253, 0.35) 0%, transparent 70%)',
            }}
          />
        </>
      )}

      {/* ── SUN (सूरज) — Morning / Day / Sunset ───────────────────── */}
      {isSunActive && (
        <div
          style={{
            position: 'fixed',
            top: timeOfDay === 'sunset' ? '45px' : '15px',
            right: '90px',
            width: '100px',
            height: '100px',
            zIndex: 105,
            pointerEvents: 'none',
            transition: 'all 1.5s ease',
          }}
        >
          <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
            <defs>
              {/* Outer Golden Solar Corona Aura */}
              <radialGradient id="sunAura" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={
                    timeOfDay === 'sunset'
                      ? 'rgba(245, 158, 11, 0.85)'
                      : timeOfDay === 'morning'
                      ? 'rgba(251, 191, 36, 0.85)'
                      : 'rgba(56, 189, 248, 0.65)'
                  }
                />
                <stop
                  offset="45%"
                  stopColor={
                    timeOfDay === 'sunset'
                      ? 'rgba(248, 113, 113, 0.35)'
                      : 'rgba(251, 191, 36, 0.35)'
                  }
                />
                <stop offset="75%" stopColor="rgba(251, 191, 36, 0.12)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>

              {/* Sun Core Gradient */}
              <linearGradient id="sunCore" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop
                  offset="40%"
                  stopColor={timeOfDay === 'sunset' ? '#FDE68A' : '#FEF08A'}
                />
                <stop
                  offset="100%"
                  stopColor={timeOfDay === 'sunset' ? '#F97316' : '#FBBF24'}
                />
              </linearGradient>

              {/* Rotating Ray Gradients */}
              <linearGradient id="sunRayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(254, 240, 138, 0.8)" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>

            {/* Glowing Corona Aura */}
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="url(#sunAura)"
              style={{ animation: 'sunGlow 4s ease-in-out infinite' }}
            />

            {/* Rotating Sun Rays (सूरज की किरणें) */}
            <g
              style={{
                transformOrigin: '50px 50px',
                animation: 'sunRay 28s linear infinite',
              }}
            >
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <rect
                  key={deg}
                  x="48.5"
                  y="8"
                  width="3"
                  height="12"
                  rx="1.5"
                  fill="url(#sunCore)"
                  transform={`rotate(${deg} 50 50)`}
                  opacity={0.8}
                />
              ))}
            </g>

            {/* Core Sun Sphere (सूरज मंडल) */}
            <circle
              cx="50"
              cy="50"
              r="22"
              fill="url(#sunCore)"
              filter={
                timeOfDay === 'sunset'
                  ? 'drop-shadow(0 0 16px rgba(245, 158, 11, 0.95)) drop-shadow(0 0 35px rgba(248, 113, 113, 0.6))'
                  : 'drop-shadow(0 0 16px rgba(251, 191, 36, 0.95)) drop-shadow(0 0 35px rgba(56, 189, 248, 0.5))'
              }
            />

            {/* Sun Gleam Specular Accent */}
            <ellipse cx="44" cy="44" rx="7" ry="4" fill="#FFFFFF" opacity="0.6" />
          </svg>
        </div>
      )}

      {/* ── MOON & STARS (चाँद और तारे) — Night ────────────────────── */}
      {isNightSkyActive && (
        <>
          {/* Glowing Celestial Crescent Moon (चाँद) */}
          <div
            style={{
              position: 'fixed',
              top: '10px',
              right: '95px',
              width: '85px',
              height: '85px',
              animation: 'moonGlow 6s ease-in-out infinite',
              zIndex: 105,
              pointerEvents: 'none',
            }}
          >
            <svg width="85" height="85" viewBox="0 0 100 100" fill="none">
              <defs>
                <radialGradient id="moonAura" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(229, 237, 247, 0.75)" />
                  <stop offset="35%" stopColor="rgba(56, 189, 248, 0.4)" />
                  <stop offset="70%" stopColor="rgba(56, 189, 248, 0.15)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <linearGradient id="moonBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="45%" stopColor="#F0F6FF" />
                  <stop offset="100%" stopColor="#93C5FD" />
                </linearGradient>
                <radialGradient id="crater" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(147, 197, 253, 0.5)" />
                  <stop offset="100%" stopColor="rgba(229, 237, 247, 0.15)" />
                </radialGradient>
              </defs>

              {/* Glowing Outer Lunar Aura */}
              <circle cx="50" cy="50" r="48" fill="url(#moonAura)" />

              {/* Crescent Moon Body */}
              <path
                d="M50 14 C68 14 82 28 82 46 C82 65 66 81 47 81 C37 81 28 76 21 68 C27 72 35 74 43 74 C61 74 75 60 75 42 C75 28 65 17 50 14 Z"
                fill="url(#moonBody)"
                filter="drop-shadow(0 0 16px rgba(229, 237, 247, 0.9)) drop-shadow(0 0 32px rgba(56, 189, 248, 0.5))"
              />

              {/* Moon Craters */}
              <circle cx="57" cy="38" r="4.5" fill="url(#crater)" />
              <circle cx="65" cy="52" r="3.5" fill="url(#crater)" />
              <circle cx="53" cy="62" r="4" fill="url(#crater)" />

              {/* Sparkles near Moon */}
              <circle cx="28" cy="22" r="2" fill="#FFFFFF" opacity="0.95" />
              <circle cx="85" cy="24" r="1.5" fill="#FFFFFF" opacity="0.85" />
              <circle cx="87" cy="62" r="2" fill="#FFFFFF" opacity="0.9" />
            </svg>
          </div>

          {/* Twinkling Circular Stars (तारे) */}
          {stars.map((s) => (
            <div
              key={`star-${s.id}`}
              style={{
                position: 'absolute',
                top: s.top,
                left: s.left,
                width: `${s.size}px`,
                height: `${s.size}px`,
                borderRadius: '50%',
                backgroundColor: s.size > 2.5 ? '#FFFFFF' : '#E5EDF7',
                boxShadow:
                  s.size > 2.5
                    ? '0 0 8px 2px rgba(255, 255, 255, 0.95), 0 0 16px rgba(56, 189, 248, 0.5)'
                    : '0 0 4px rgba(255, 255, 255, 0.6)',
                animation: s.isSparkle
                  ? `starPulse ${s.duration}s ease-in-out ${s.delay}s infinite`
                  : `starTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}

          {/* 4-Point Sparkling Stars (✨ चमकीले तारे) */}
          {crossStars.map((cs) => (
            <div
              key={`cross-star-${cs.id}`}
              style={{
                position: 'absolute',
                top: cs.top,
                left: cs.left,
                width: `${cs.size}px`,
                height: `${cs.size}px`,
                animation: `starPulse ${cs.duration}s ease-in-out ${cs.delay}s infinite`,
                filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.9))',
              }}
            >
              <svg width={cs.size} height={cs.size} viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 0 L14 9 L24 12 L14 15 L12 24 L10 15 L0 12 L10 9 Z"
                  fill="#FFFFFF"
                />
              </svg>
            </div>
          ))}

          {/* Shooting Star 1 (टूटता तारा) */}
          <div
            style={{
              position: 'absolute',
              top: '12%',
              right: '18%',
              width: '150px',
              height: '2px',
              background: 'linear-gradient(to right, transparent, rgba(56, 189, 248, 0.7), #FFFFFF)',
              borderRadius: '999px',
              boxShadow: '0 0 10px #FFFFFF',
              animation: 'shootingStar 7s ease-in-out 1.2s infinite',
            }}
          />

          {/* Shooting Star 2 */}
          <div
            style={{
              position: 'absolute',
              top: '28%',
              right: '42%',
              width: '120px',
              height: '1.5px',
              background: 'linear-gradient(to right, transparent, rgba(56, 189, 248, 0.6), #FFFFFF)',
              borderRadius: '999px',
              boxShadow: '0 0 8px #FFFFFF',
              animation: 'shootingStar 11s ease-in-out 5s infinite',
            }}
          />

          {/* Shooting Star 3 */}
          <div
            style={{
              position: 'absolute',
              top: '48%',
              right: '25%',
              width: '100px',
              height: '1.5px',
              background: 'linear-gradient(to right, transparent, rgba(56, 189, 248, 0.5), #FFFFFF)',
              borderRadius: '999px',
              boxShadow: '0 0 8px #FFFFFF',
              animation: 'shootingStar 9s ease-in-out 3s infinite',
            }}
          />
        </>
      )}

      {/* ── WIND STREAKS (हवा / Wind) ──────────────────────────────── */}
      {isWindy &&
        windStreaks.map((w) => (
          <div
            key={`wind-${w.id}`}
            style={{
              position: 'absolute',
              top: `${w.top}%`,
              left: 0,
              width: `${w.width}px`,
              height: '2px',
              background:
                'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.75), rgba(255, 255, 255, 0.9), transparent)',
              borderRadius: '999px',
              filter: 'blur(0.5px)',
              boxShadow: '0 0 6px rgba(56, 189, 248, 0.4)',
              animation: `windFlow ${w.duration}s ease-in-out ${w.delay}s infinite`,
            }}
          />
        ))}

      {/* ── RAINDROPS (बारिश / Rain) ──────────────────────────────── */}
      {isRaining &&
        rainDrops.map((drop) => (
          <div
            key={`drop-${drop.id}`}
            style={{
              position: 'absolute',
              left: `${drop.left}%`,
              top: 0,
              width: isStorm ? '1.5px' : '1px',
              height: `${drop.height}px`,
              background:
                'linear-gradient(to bottom, transparent, rgba(56, 189, 248, 0.7), #FFFFFF)',
              opacity: drop.opacity,
              transform: isWindy ? 'rotate(12deg)' : 'rotate(4deg)',
              animation: `rainFall ${drop.duration}s ${drop.delay}s linear infinite`,
            }}
          />
        ))}

      {/* ── SNOWFLAKES (बर्फ / Snow) ──────────────────────────────── */}
      {isSnowing &&
        snowFlakes.map((flake) => (
          <div
            key={`flake-${flake.id}`}
            style={{
              position: 'absolute',
              left: `${flake.left}%`,
              top: 0,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 5px rgba(255, 255, 255, 0.8)',
              opacity: flake.opacity,
              animation: `snowFall ${flake.duration}s ${flake.delay}s ease-in-out infinite`,
            }}
          />
        ))}
    </div>
  );
};

export default WeatherBackground;
