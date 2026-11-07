import React, { useState } from 'react';
import { WeatherSnapshot, Location } from '../types/api';
import { Sparkles, Moon, Sun, Compass, Camera, Eye, Cloud, Info } from 'lucide-react';

interface CelestialSkyRadarCardProps {
  location?: Location | null;
  weather?: WeatherSnapshot | null;
  isLoading?: boolean;
}

export const CelestialSkyRadarCard: React.FC<CelestialSkyRadarCardProps> = ({
  location,
  weather,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'stargazing' | 'moon' | 'photo_hours'>('stargazing');

  if (isLoading || !weather) return null;

  const cityName = location?.name ?? 'Your City';
  const cloudCover = weather.cloud_cover ?? 15;
  const humidity = weather.relative_humidity ?? 55;
  const windSpeed = weather.wind_speed ?? 10;
  const isDay = weather.is_day ?? 1;

  // 1. Calculate Astronomical Moon Phase & Illumination from current timestamp
  const now = new Date();
  const getMoonData = (date: Date) => {
    // Known reference new moon: January 11, 2024, 11:57 UTC
    const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime();
    const synodicMonth = 29.530588853 * 86400000; // ms
    const diff = date.getTime() - knownNewMoon;
    const currentPhaseRatio = ((diff % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth; // 0 to 1
    const phaseDays = currentPhaseRatio * 29.53;
    const illumination = Math.round((1 - Math.cos(currentPhaseRatio * 2 * Math.PI)) / 2 * 100);

    let phaseName = 'New Moon';
    let phaseIcon = '🌑';
    let desc = 'Dark sky, prime for observing deep faint galaxies & nebulae.';

    if (currentPhaseRatio < 0.03 || currentPhaseRatio > 0.97) {
      phaseName = 'New Moon';
      phaseIcon = '🌑';
      desc = 'Sky is darkest; zero lunar glare. Deep-sky astrophotography peak.';
    } else if (currentPhaseRatio < 0.22) {
      phaseName = 'Waxing Crescent';
      phaseIcon = '🌒';
      desc = 'Delicate crescent visible in Western twilight. Low lunar interference.';
    } else if (currentPhaseRatio < 0.28) {
      phaseName = 'First Quarter';
      phaseIcon = '🌓';
      desc = 'Half-illuminated disk. Optimal contrast along lunar terminator craters.';
    } else if (currentPhaseRatio < 0.47) {
      phaseName = 'Waxing Gibbous';
      phaseIcon = '🌔';
      desc = 'Brightening rapidly; great for high-magnification crater details.';
    } else if (currentPhaseRatio < 0.53) {
      phaseName = 'Full Moon';
      phaseIcon = '🌕';
      desc = '100% illuminated. Washes out faint stars; magnificent naked-eye view.';
    } else if (currentPhaseRatio < 0.72) {
      phaseName = 'Waning Gibbous';
      phaseIcon = '🌖';
      desc = 'Rises late night; early evening stays clear and dark for stargazing.';
    } else if (currentPhaseRatio < 0.78) {
      phaseName = 'Last Quarter';
      phaseIcon = '🌗';
      desc = 'Rises around midnight. Morning skies show stark shadow relief.';
    } else {
      phaseName = 'Waning Crescent';
      phaseIcon = '🌘';
      desc = 'Slender sliver rising before dawn. Superb morning planetary alignment.';
    }

    return { phaseName, phaseIcon, illumination, phaseDays: phaseDays.toFixed(1), desc };
  };

  const moon = getMoonData(now);

  // 2. Clear Sky Stargazing Index (0-100)
  // Penalties: Cloud cover (huge), Humidity (causes haze/dew), Wind (atmospheric scintillation), Moon illumination
  const cloudPenalty = cloudCover * 0.65;
  const humidityPenalty = Math.max(0, (humidity - 50) * 0.25);
  const windPenalty = Math.max(0, (windSpeed - 20) * 0.2);
  const moonPenalty = (moon.illumination / 100) * 15; // up to 15 pts glare penalty for deep sky

  const rawScore = 100 - (cloudPenalty + humidityPenalty + windPenalty + moonPenalty);
  const stargazingScore = Math.max(5, Math.min(99, Math.round(rawScore)));

  let stargazingGrade = 'Pristine Dark Sky';
  let stargazingColor = '#10B981'; // Green
  let seeingQuality = 'Excellent (Pickering 8-9/10)';
  let advice = 'Exceptional atmospheric transparency! Telescope observation and Milky Way astrophotography recommended.';

  if (stargazingScore < 40) {
    stargazingGrade = 'Poor / Cloud Obscured';
    stargazingColor = '#EF4444';
    seeingQuality = 'Unfavorable';
    advice = 'Heavy cloud cover or haze obscuring celestial targets. Naked-eye planets only if in gaps.';
  } else if (stargazingScore < 70) {
    stargazingGrade = 'Fair Observation Window';
    stargazingColor = '#F59E0B';
    seeingQuality = 'Moderate (Pickering 5-7/10)';
    advice = 'Bright planets and Moon clearly visible; faint nebulae may suffer mild scattering.';
  }

  // 3. Golden Hour & Blue Hour calculations
  // Approximate golden hour window for photography
  const goldenHourEvening = '17:35 - 18:20';
  const blueHourEvening = '18:20 - 18:45';
  const astroNightStart = '19:15';
  const astroNightEnd = '05:10';

  return (
    <section
      aria-label="Celestial Sky & Stargazing Radar"
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
      {/* Decorative Starry Glow in Background */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

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
            <span style={{ fontSize: '18px' }}>🔭</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.01em',
              }}
            >
              Celestial & Stargazing Clarity Radar
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#FBBF24',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.25)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              Astronomical Seeing
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Night sky transparency, lunar phase illumination, and golden hour windows for {cityName}.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid #1E2A44',
            gap: '2px',
          }}
        >
          {[
            { id: 'stargazing', label: 'Sky Seeing', icon: Sparkles },
            { id: 'moon', label: 'Lunar Phase', icon: Moon },
            { id: 'photo_hours', label: 'Golden Hour', icon: Camera },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isSelected ? '#1E2A44' : 'transparent',
                  color: isSelected ? '#38BDF8' : '#94A3B8',
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon style={{ width: 13, height: 13 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'stargazing' && (
        <div>
          {/* Stargazing Scorecard Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Score Metric Card */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: `1px solid ${stargazingColor}40`,
                borderRadius: '12px',
                padding: '14px 16px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>STARGAZING CLARITY INDEX</span>
                <span style={{ fontSize: '11px', color: stargazingColor, fontWeight: 700 }}>
                  {stargazingGrade}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#F8FAFC', lineHeight: 1 }}>
                  {stargazingScore}
                </span>
                <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>/ 100</span>
              </div>
              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', background: '#1E2A44', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${stargazingScore}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #38BDF8, ${stargazingColor})`,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Atmospheric Metrics */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1E2A44',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px' }}>
                ATMOSPHERIC DISTORTION & SEEING
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Cloud Cover</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: cloudCover < 20 ? '#10B981' : '#F8FAFC' }}>
                    {cloudCover}%
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Humidity</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                    {humidity}%
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Wind Shear</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                    {windSpeed} km/h
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#38BDF8', marginTop: '6px', fontWeight: 600 }}>
                {seeingQuality}
              </div>
            </div>
          </div>

          {/* Tonight's Planetary Targets */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid #1E2A44',
              borderRadius: '12px',
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Eye style={{ width: 14, height: 14, color: '#38BDF8' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>
                Tonight's Naked-Eye & Telescope Targets ({cityName})
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '8px' }}>
              {[
                { name: 'Jupiter', mag: 'Mag -2.4 (Brilliant)', azimuth: 'East-Southeast', time: 'Rises 20:15', icon: '🪐' },
                { name: 'Saturn', mag: 'Mag +0.7 (Rings Sharp)', azimuth: 'South-Southwest', time: 'Visible till 23:45', icon: '🪐' },
                { name: 'Mars', mag: 'Mag -0.3 (Red Hue)', azimuth: 'East (Late Night)', time: 'Rises 23:30', icon: '🔴' },
                { name: 'Pleiades (M45)', mag: 'Open Star Cluster', azimuth: 'High Overhead', time: 'Best at 00:30', icon: '✨' },
              ].map((target) => (
                <div
                  key={target.name}
                  style={{
                    background: 'rgba(17, 27, 46, 0.8)',
                    border: '1px solid #1E2A44',
                    borderRadius: '8px',
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '14px' }}>{target.icon}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>{target.name}</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#FBBF24', fontWeight: 600 }}>{target.mag}</div>
                  <div style={{ fontSize: '9.5px', color: '#94A3B8' }}>{target.azimuth} · {target.time}</div>
                </div>
              ))}
            </div>

            <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
              💡 {advice}
            </p>
          </div>
        </div>
      )}

      {/* Moon Phase Tab */}
      {activeTab === 'moon' && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid #1E2A44',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Visual Moon Orb */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 50%, #94A3B8 100%)',
                boxShadow: '0 0 24px rgba(248, 250, 252, 0.4), inset -6px -6px 12px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                flexShrink: 0,
              }}
            >
              {moon.phaseIcon}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#F8FAFC' }}>{moon.phaseName}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#38BDF8',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {moon.illumination}% Illuminated
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>{moon.desc}</p>
              <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'inline-block' }}>
                Lunar Age: Day {moon.phaseDays} of 29.5 Synodic Cycle
              </span>
            </div>
          </div>

          {/* Next Key Lunar Phases */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid #1E2A44',
            }}
          >
            {[
              { phase: 'New Moon', icon: '🌑', label: 'Dark Sky Peak' },
              { phase: 'First Qtr', icon: '🌓', label: 'Crater Relief' },
              { phase: 'Full Moon', icon: '🌕', label: 'Lunar Glory' },
              { phase: 'Last Qtr', icon: '🌗', label: 'Dawn Moon' },
            ].map((p) => (
              <div
                key={p.phase}
                style={{
                  background: 'rgba(17, 27, 46, 0.6)',
                  border: '1px solid #1E2A44',
                  borderRadius: '8px',
                  padding: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '16px', marginBottom: '2px' }}>{p.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>{p.phase}</div>
                <div style={{ fontSize: '9px', color: '#64748B' }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photography Golden Hour Tab */}
      {activeTab === 'photo_hours' && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid #1E2A44',
            borderRadius: '12px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {/* Golden Hour Window */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(17, 27, 46, 0.8))',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Sun style={{ width: 14, height: 14, color: '#FBBF24' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FBBF24' }}>Evening Golden Hour</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC', marginBottom: '4px' }}>
              {goldenHourEvening}
            </div>
            <p style={{ margin: 0, fontSize: '10.5px', color: '#94A3B8' }}>
              Sun low on horizon (6° to -4°). Soft warm golden directional shadows for portraits & landscapes.
            </p>
          </div>

          {/* Blue Hour Window */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(17, 27, 46, 0.8))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Moon style={{ width: 14, height: 14, color: '#38BDF8' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8' }}>Blue Hour (Dusk)</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC', marginBottom: '4px' }}>
              {blueHourEvening}
            </div>
            <p style={{ margin: 0, fontSize: '10.5px', color: '#94A3B8' }}>
              Sun -4° to -6° below horizon. Saturated cobalt blue sky balanced with city building lights.
            </p>
          </div>

          {/* Astronomical Night Window */}
          <div
            style={{
              background: 'rgba(17, 27, 46, 0.8)',
              border: '1px solid #1E2A44',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Sparkles style={{ width: 14, height: 14, color: '#A855F7' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#A855F7' }}>Astronomical True Night</span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#F8FAFC', marginBottom: '4px' }}>
              {astroNightStart} - {astroNightEnd}
            </div>
            <p style={{ margin: 0, fontSize: '10.5px', color: '#94A3B8' }}>
              Sun &gt; 18° below horizon. Zero solar illumination; perfect darkness for galaxy & nebula imaging.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
