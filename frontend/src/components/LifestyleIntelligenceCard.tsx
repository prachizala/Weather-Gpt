import React, { useState } from 'react';
import { WeatherSnapshot, ForecastData, AirQuality } from '../types/api';
import {
  Shirt,
  Flame,
  SunMedium,
  HeartPulse,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info
} from 'lucide-react';

interface LifestyleIntelligenceCardProps {
  weather: WeatherSnapshot | null;
  forecast: ForecastData | null;
  airQuality: AirQuality | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
}

interface LifestyleMetric {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  status: string;
  statusType: 'success' | 'warning' | 'info' | 'danger';
  recommendation: string;
  detail: string;
}

export const LifestyleIntelligenceCard: React.FC<LifestyleIntelligenceCardProps> = ({
  weather,
  forecast,
  airQuality,
  units,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<string>('outfit');

  if (isLoading || !weather) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <div
          className="skeleton"
          style={{
            height: '180px',
            borderRadius: '16px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        />
      </div>
    );
  }

  const temp = weather.temperature;
  const feelsLike = weather.apparent_temperature ?? temp;
  const humidity = weather.relative_humidity ?? 50;
  const windSpeed = weather.wind_speed ?? 0;
  const aqi = airQuality?.aqi ?? airQuality?.us_aqi ?? 65;
  const uv = airQuality?.uv_index ?? 5;
  const todayForecast = forecast?.daily?.[0];
  const maxRainProb = todayForecast?.precipitation_probability_max ?? 0;
  const maxTemp = todayForecast?.temperature_max ?? temp;

  // 1. Outfit Recommendation Logic
  let outfitStatus = 'Comfortable Cotton';
  let outfitType: 'success' | 'warning' | 'info' | 'danger' = 'success';
  let outfitRec = 'Light, breathable cotton or linen fabrics recommended.';
  let outfitDetail = `Current feels-like is ${feelsLike.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}.`;

  if (maxRainProb >= 50) {
    outfitStatus = 'Rain Gear Essential';
    outfitType = 'warning';
    outfitRec = 'Carry a compact umbrella or waterproof jacket. Rain probability reaches ' + maxRainProb + '%.';
    outfitDetail = 'High chance of intermittent showers throughout the day.';
  } else if (feelsLike >= 35) {
    outfitStatus = 'Ultra-Light Breathable';
    outfitType = 'warning';
    outfitRec = 'Wear loose, light-colored cotton clothes and UV sunglasses. Stay in shade.';
    outfitDetail = `High thermal stress (feels like ${feelsLike.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'} with ${humidity}% humidity).`;
  } else if (feelsLike < 16) {
    outfitStatus = 'Light Layering';
    outfitType = 'info';
    outfitRec = 'Wear a light sweater, cardigan, or denim jacket, especially in the evening.';
    outfitDetail = `Crisp and cool air (feels like ${feelsLike.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}).`;
  } else {
    outfitStatus = 'Casual Daily Wear';
    outfitType = 'success';
    outfitRec = 'Comfortable t-shirt and light trousers or casual wear are ideal.';
    outfitDetail = `Moderate temperature of ${temp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'} with mild breeze (${windSpeed.toFixed(0)} km/h).`;
  }

  // 2. Outdoor Workout & Fitness Window
  let workoutStatus = 'Great for Cardio';
  let workoutType: 'success' | 'warning' | 'info' | 'danger' = 'success';
  let workoutRec = 'Optimal time for running or cycling: 6:00 AM – 7:45 AM.';
  let workoutDetail = 'Cooler ground temperature and lower traffic emissions in early morning.';

  if (aqi > 150) {
    workoutStatus = 'Indoor Workout Advised';
    workoutType = 'danger';
    workoutRec = `Air Quality Index is elevated (${aqi}). Exercise indoors (gym/treadmill).`;
    workoutDetail = 'High particulate matter increases lung exposure during heavy cardio.';
  } else if (maxTemp > 36) {
    workoutStatus = 'Morning Only (Heat Caution)';
    workoutType = 'warning';
    workoutRec = 'Workout strictly before 8:00 AM or after 7:30 PM. Avoid afternoon sessions.';
    workoutDetail = `Peak daytime temperature reaches ${maxTemp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}. Hydrate frequently.`;
  } else if (maxRainProb > 60) {
    workoutStatus = 'Wet Track Risk';
    workoutType = 'warning';
    workoutRec = 'Watch for slippery outdoor running tracks. Consider gym or cross-training.';
    workoutDetail = `Precipitation probability is elevated (${maxRainProb}%).`;
  } else {
    workoutStatus = 'Favorable Outdoor Window';
    workoutType = 'success';
    workoutRec = 'Morning (6:30–8:00 AM) and evening (6:00–7:30 PM) are both comfortable.';
    workoutDetail = `Moderate AQI (${aqi}) and manageable heat index.`;
  }

  // 3. Laundry & Drying Index
  let laundryStatus = 'Rapid Outdoor Drying';
  let laundryType: 'success' | 'warning' | 'info' | 'danger' = 'success';
  let laundryRec = 'Great day for outdoor line drying. Clothes should dry in ~2.5 to 3 hours.';
  let laundryDetail = `Humidity is ${humidity}% and rain chance is low (${maxRainProb}%).`;

  if (maxRainProb >= 40) {
    laundryStatus = 'Indoor Drying Recommended';
    laundryType = 'warning';
    laundryRec = 'Keep laundry under covered patio or indoors to avoid unexpected dampness.';
    laundryDetail = `Rain risk is ${maxRainProb}% with fluctuating cloud cover.`;
  } else if (humidity > 75) {
    laundryStatus = 'Slow Drying Window';
    laundryType = 'info';
    laundryRec = 'Clothes will take longer to dry due to high air moisture. Allow 5+ hours.';
    laundryDetail = `High relative humidity (${humidity}%) slows down evaporation.`;
  }

  // 4. Health & Comfort Shield (UV, AQI, Allergies)
  let healthStatus = 'Low Health Risk';
  let healthType: 'success' | 'warning' | 'info' | 'danger' = 'success';
  let healthRec = 'Environmental conditions are favorable for all demographic groups.';
  let healthDetail = `Air quality (${aqi}) and UV index (${uv.toFixed(1)}) are within acceptable limits.`;

  if (aqi > 150) {
    healthStatus = 'Sensitive Lungs Alert';
    healthType = 'danger';
    healthRec = 'Individuals with asthma or respiratory allergies should wear an N95 outdoors.';
    healthDetail = `PM2.5 / PM10 levels are significantly elevated (AQI ${aqi}).`;
  } else if (uv >= 8) {
    healthStatus = 'Very High UV Warning';
    healthType = 'warning';
    healthRec = 'Apply SPF 50+ sunscreen, wear wide-brim hats, and limit direct sun between 11 AM – 3 PM.';
    healthDetail = `UV index of ${uv.toFixed(1)} can cause skin damage in under 20 minutes of exposure.`;
  } else if (aqi > 100) {
    healthStatus = 'Moderate AQI Awareness';
    healthType = 'warning';
    healthRec = 'Unusually sensitive individuals should monitor throat or eye irritation.';
    healthDetail = `AQI is ${aqi}. Morning walks in green parks are preferred.`;
  }

  const metrics: LifestyleMetric[] = [
    {
      id: 'outfit',
      title: 'Outfit & Gear',
      subtitle: 'What to wear',
      icon: <Shirt style={{ width: 18, height: 18 }} />,
      status: outfitStatus,
      statusType: outfitType,
      recommendation: outfitRec,
      detail: outfitDetail,
    },
    {
      id: 'workout',
      title: 'Fitness & Cardio',
      subtitle: 'Outdoor exercise',
      icon: <Flame style={{ width: 18, height: 18 }} />,
      status: workoutStatus,
      statusType: workoutType,
      recommendation: workoutRec,
      detail: workoutDetail,
    },
    {
      id: 'laundry',
      title: 'Laundry & Drying',
      subtitle: 'Sun drying index',
      icon: <SunMedium style={{ width: 18, height: 18 }} />,
      status: laundryStatus,
      statusType: laundryType,
      recommendation: laundryRec,
      detail: laundryDetail,
    },
    {
      id: 'health',
      title: 'Health & Comfort',
      subtitle: 'AQI & UV protection',
      icon: <HeartPulse style={{ width: 18, height: 18 }} />,
      status: healthStatus,
      statusType: healthType,
      recommendation: healthRec,
      detail: healthDetail,
    },
  ];

  const activeMetric = metrics.find((m) => m.id === activeTab) || metrics[0];

  const getStatusBadgeStyle = (type: string) => {
    switch (type) {
      case 'success':
        return { backgroundColor: 'rgba(52, 211, 153, 0.15)', color: 'var(--success)', border: '1px solid rgba(52, 211, 153, 0.3)' };
      case 'warning':
        return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'danger':
        return { backgroundColor: 'rgba(248, 113, 113, 0.15)', color: 'var(--danger)', border: '1px solid rgba(248, 113, 113, 0.3)' };
      default:
        return { backgroundColor: 'rgba(56, 189, 248, 0.15)', color: 'var(--primary)', border: '1px solid rgba(56, 189, 248, 0.3)' };
    }
  };

  return (
    <section
      aria-label="Daily Lifestyle and Actionable Intelligence"
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
            <Sparkles style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
              Lifestyle & Activity Intelligence
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Actionable daily insights translated from real-time meteorological metrics
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
          <ShieldCheck style={{ width: 14, height: 14, color: 'var(--success)' }} />
          <span>Factual Life Context</span>
        </div>
      </div>

      {/* 4 Metric Quick Tabs / Pills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {metrics.map((m) => {
          const isActive = m.id === activeTab;
          return (
            <button
              key={m.id}
              onClick={() => setActiveTab(m.id)}
              aria-pressed={isActive}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg)',
                border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginBottom: '6px',
                }}
              >
                <div style={{ color: isActive ? 'var(--primary)' : 'var(--muted)' }}>{m.icon}</div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    ...getStatusBadgeStyle(m.statusType),
                  }}
                >
                  {m.statusType.toUpperCase()}
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isActive ? 'var(--text)' : 'var(--muted)',
                  lineHeight: 1.2,
                }}
              >
                {m.title}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                {m.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Detailed Recommendation Box */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          animation: 'slideUp 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--primary)' }}>{activeMetric.icon}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
              {activeMetric.title}:
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                ...getStatusBadgeStyle(activeMetric.statusType),
              }}
            >
              {activeMetric.status}
            </span>
          </div>

          <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Info style={{ width: 12, height: 12 }} />
            Live Recommendation
          </span>
        </div>

        <p
          style={{
            fontSize: '13px',
            color: 'var(--text)',
            lineHeight: 1.5,
            margin: '4px 0 0 0',
            fontWeight: 500,
          }}
        >
          {activeMetric.recommendation}
        </p>

        <p
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            lineHeight: 1.4,
            margin: '2px 0 0 0',
          }}
        >
          {activeMetric.detail}
        </p>
      </div>
    </section>
  );
};
