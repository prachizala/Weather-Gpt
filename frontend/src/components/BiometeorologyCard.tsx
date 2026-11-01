import React, { useState } from 'react';
import { WeatherSnapshot, AirQuality } from '../types/api';

interface BiometeorologyCardProps {
  current?: WeatherSnapshot | null;
  airQuality?: AirQuality | null;
  cityName?: string;
  onAskAI?: (prompt: string) => void;
}

type HealthProfile = 'migraine' | 'respiratory' | 'uv_skin' | 'sinus_allergy';

export const BiometeorologyCard: React.FC<BiometeorologyCardProps> = ({
  current,
  airQuality,
  cityName = 'Current Location',
  onAskAI
}) => {
  const [activeProfile, setActiveProfile] = useState<HealthProfile>('migraine');

  if (!current) return null;

  const temp = current.temperature ?? 25;
  const humidity = current.relative_humidity ?? 50;
  const pressure = current.surface_pressure ?? 1013;
  const windSpeed = current.wind_speed ?? 10;
  const pm25 = airQuality?.pm2_5 ?? 25;
  const pm10 = airQuality?.pm10 ?? 45;
  const uvIndex = airQuality?.uv_index ?? 3.5;

  // 1. Migraine Calculation: standard sea-level is 1013.25 hPa. High deviation or low pressure increases cranial pressure
  const pressureDelta = Math.abs(pressure - 1013.25);
  let migraineScore = Math.min(100, Math.round((pressureDelta / 15) * 60 + (humidity > 75 ? 25 : 10)));
  if (temp > 35 || temp < 10) migraineScore = Math.min(100, migraineScore + 15);

  // 2. Respiratory & Asthma Calculation: PM2.5 + PM10 + humidity extremes + cold air
  let respiratoryScore = Math.min(100, Math.round((pm25 / 60) * 50 + (pm10 / 100) * 20 + (humidity > 80 || humidity < 25 ? 20 : 5)));

  // 3. UV & Skin Calculation: UV Index * 10
  let uvScore = Math.min(100, Math.round((uvIndex / 11) * 100));
  const safeSunMinutes = uvIndex <= 2 ? 60 : uvIndex <= 5 ? 30 : uvIndex <= 7 ? 15 : 8;

  // 4. Sinus & Dust Allergy: wind dispersal + dry air + PM10
  let sinusScore = Math.min(100, Math.round((pm10 / 80) * 45 + (windSpeed > 20 ? 30 : 10) + (humidity < 40 ? 25 : 5)));

  const getRiskLevel = (score: number) => {
    if (score < 30) return { label: 'Low Risk', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
    if (score < 60) return { label: 'Moderate Caution', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' };
    if (score < 80) return { label: 'Elevated Sensitivity', color: '#F97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)' };
    return { label: 'High Clinical Load', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
  };

  const profilesData = {
    migraine: {
      title: 'Migraine & Barometric Headache',
      icon: '🧠',
      score: migraineScore,
      primaryMetric: `${pressure.toFixed(1)} hPa`,
      primaryLabel: 'Surface Pressure',
      secondaryMetric: `${pressureDelta.toFixed(1)} hPa dev`,
      secondaryLabel: 'Delta from 1013.2 hPa',
      risk: getRiskLevel(migraineScore),
      summary: pressure < 1008
        ? 'Low atmospheric pressure induces dilation of cranial blood vessels, triggering barometric migraines.'
        : pressure > 1018
        ? 'High atmospheric pressure dome. Stable conditions with minimal pressure variation triggers.'
        : 'Standard atmospheric pressure band. Minimal barometric strain detected for headache sufferers.',
      preventions: [
        'Maintain steady hydration (drink electrolyte water)',
        'Avoid prolonged high-brightness screen glare',
        'Keep anti-inflammatory medication or herbal tea accessible if sensitive'
      ],
      aiPrompt: `Analyze the current atmospheric pressure of ${pressure.toFixed(1)} hPa and humidity of ${humidity}% in ${cityName} and provide evidence-based migraine prevention and relief techniques.`
    },
    respiratory: {
      title: 'Asthma & Airway Sensitivity',
      icon: '🫁',
      score: respiratoryScore,
      primaryMetric: `${pm25.toFixed(1)} µg/m³`,
      primaryLabel: 'Fine PM2.5 Particulates',
      secondaryMetric: `${humidity}%`,
      secondaryLabel: 'Airway Moisture',
      risk: getRiskLevel(respiratoryScore),
      summary: pm25 > 50
        ? 'Elevated fine particulates combined with ambient moisture can irritate bronchial pathways and induce wheezing.'
        : 'Particulate air levels are within comfortable bounds for most individuals with respiratory sensitivities.',
      preventions: [
        'Keep prescribed rescue inhaler accessible during outdoor transits',
        'Wear an N95/FFP2 mask if commuting along heavy traffic corridors',
        'Use indoor HEPA air filtration if experiencing nasal tightness'
      ],
      aiPrompt: `Explain how the current PM2.5 level (${pm25} µg/m³) and humidity (${humidity}%) in ${cityName} impacts asthma patients and what clinical precautions should be taken.`
    },
    uv_skin: {
      title: 'Skin Care & Safe Vitamin D Window',
      icon: '☀️',
      score: uvScore,
      primaryMetric: `UV ${uvIndex.toFixed(1)}`,
      primaryLabel: 'Solar UV Index',
      secondaryMetric: `${safeSunMinutes} mins`,
      secondaryLabel: 'Safe Sun Time (No SPF)',
      risk: getRiskLevel(uvScore),
      summary: uvIndex >= 6
        ? 'High ultraviolet radiation index. Erythema (sunburn) risk occurs rapidly without broad-spectrum protection.'
        : uvIndex >= 3
        ? 'Moderate solar radiation. Ideal 15-20 min window for healthy natural cutaneous Vitamin D synthesis.'
        : 'Low UV radiation. Safe for extended unprotected outdoor daylight exposure.',
      preventions: [
        `Apply SPF 30+ or SPF 50+ sunscreen if outdoors past ${safeSunMinutes} minutes`,
        'Wear UV400 sunglasses to protect retinal tissue',
        'Seek shaded canopy areas during midday peak solar altitude'
      ],
      aiPrompt: `What is the optimal sun exposure duration for Vitamin D synthesis vs sunburn risk in ${cityName} today with a UV Index of ${uvIndex}?`
    },
    sinus_allergy: {
      title: 'Sinus & Dust Dispersion Index',
      icon: '🌿',
      score: sinusScore,
      primaryMetric: `${pm10.toFixed(0)} µg/m³`,
      primaryLabel: 'Coarse Dust (PM10)',
      secondaryMetric: `${windSpeed.toFixed(1)} km/h`,
      secondaryLabel: 'Surface Wind Turbulence',
      risk: getRiskLevel(sinusScore),
      summary: windSpeed > 18 && pm10 > 60
        ? 'Wind gusts are agitating ground particulate dust and pollen, increasing rhinitis and allergic mucosal reactions.'
        : 'Low turbulence and particulate suspension. Mucous membranes are under minimal environmental stress.',
      preventions: [
        'Perform sterile saline nasal irrigation after returning indoors',
        'Keep vehicle windows closed during highway travel',
        'Rinse face and eyes with fresh cool water after outdoor activity'
      ],
      aiPrompt: `How do current wind speeds of ${windSpeed} km/h and PM10 levels of ${pm10} in ${cityName} affect allergic rhinitis and sinus sufferers today?`
    }
  };

  const currentProfile = profilesData[activeProfile];

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(17, 27, 46, 0.95), rgba(11, 18, 32, 0.98))',
        border: '1px solid #1E2A44',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>🏥</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
              Personalized Biometeorology & Health Radar
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
            >
              Clinical Weather Impact
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Predictive physiological sensitivity indicators based on real-time barometric pressure, particulates & solar radiation.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: currentProfile.risk.bg,
            border: `1px solid ${currentProfile.risk.border}`,
            padding: '6px 12px',
            borderRadius: '20px'
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentProfile.risk.color,
              boxShadow: `0 0 8px ${currentProfile.risk.color}`
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: currentProfile.risk.color }}>
            {currentProfile.risk.label} ({currentProfile.score}/100)
          </span>
        </div>
      </div>

      {/* Profile Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '20px'
        }}
      >
        {(['migraine', 'respiratory', 'uv_skin', 'sinus_allergy'] as HealthProfile[]).map((key) => {
          const item = profilesData[key];
          const isSelected = activeProfile === key;
          return (
            <button
              key={key}
              onClick={() => setActiveProfile(key)}
              style={{
                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(17, 27, 46, 0.6)',
                border: isSelected ? '1px solid #38BDF8' : '1px solid #1E2A44',
                borderRadius: '10px',
                padding: '10px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: item.risk.color
                  }}
                >
                  {item.score}%
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#F8FAFC' : '#94A3B8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {key === 'migraine' ? 'Migraine' : key === 'respiratory' ? 'Asthma / Airway' : key === 'uv_skin' ? 'UV & Skin' : 'Sinus / Allergy'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Profile Details Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid #1E2A44',
          borderRadius: '12px',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Left Column: Diagnostics & Meter */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>{currentProfile.icon}</span>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
              {currentProfile.title}
            </h4>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
            {currentProfile.summary}
          </p>

          {/* Progress Bar */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
              <span>Physiological Stress Index</span>
              <span style={{ fontWeight: 700, color: currentProfile.risk.color }}>{currentProfile.score} / 100</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: '#1E2A44',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div
                style={{
                  width: `${currentProfile.score}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #10B981, ${currentProfile.risk.color})`,
                  borderRadius: '4px',
                  transition: 'width 0.5s ease-out'
                }}
              />
            </div>
          </div>

          {/* Key Metrics Dual Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div
              style={{
                background: 'rgba(17, 27, 46, 0.8)',
                border: '1px solid #1E2A44',
                borderRadius: '8px',
                padding: '8px 10px'
              }}
            >
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                {currentProfile.primaryLabel}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                {currentProfile.primaryMetric}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(17, 27, 46, 0.8)',
                border: '1px solid #1E2A44',
                borderRadius: '8px',
                padding: '8px 10px'
              }}
            >
              <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                {currentProfile.secondaryLabel}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#FBBF24', marginTop: '2px' }}>
                {currentProfile.secondaryMetric}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preventive Action Protocol & AI Bridge */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              🛡️ Clinical Prevention Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {currentProfile.preventions.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    fontSize: '11.5px',
                    color: '#E2E8F0',
                    lineHeight: 1.4
                  }}
                >
                  <span style={{ color: currentProfile.risk.color, fontSize: '10px', marginTop: '2px' }}>▸</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Consultation Trigger */}
          {onAskAI && (
            <button
              onClick={() => onAskAI(currentProfile.aiPrompt)}
              style={{
                marginTop: '14px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#38BDF8',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
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
              <span>💬 Ask WeatherGPT about this health sensitivity</span>
              <span style={{ fontSize: '12px' }}>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
