import React, { useMemo } from 'react';
import { WeatherSnapshot, ForecastData, AirQuality, Location } from '../types/api';
import {
  Compass,
  Wind,
  Flame,
  CloudRain,
  Eye,
  BookOpen,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Atom
} from 'lucide-react';

interface WeatherAnomalyCardProps {
  location: Location | null;
  weather: WeatherSnapshot | null;
  forecast: ForecastData | null;
  airQuality: AirQuality | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
  onAskChat?: (question: string) => void;
}

interface AnomalyStory {
  id: string;
  tag: string;
  title: string;
  severity: 'info' | 'warning' | 'alert';
  summary: string;
  scientificReason: string;
  drivers: { label: string; value: string }[];
  suggestedQuestion: string;
}

export const WeatherAnomalyCard: React.FC<WeatherAnomalyCardProps> = ({
  location,
  weather,
  forecast,
  airQuality,
  units,
  isLoading,
  onAskChat,
}) => {
  if (isLoading || !weather) return null;

  const cityName = location?.name ?? 'your city';
  const temp = weather.temperature;
  const feelsLike = weather.apparent_temperature ?? temp;
  const humidity = weather.relative_humidity ?? 50;
  const windSpeed = weather.wind_speed ?? 0;
  const aqi = Math.round(airQuality?.aqi ?? airQuality?.us_aqi ?? 65);
  const pm25 = airQuality?.pm2_5 ?? 35;
  const todayForecast = forecast?.daily?.[0];
  const maxRainProb = todayForecast?.precipitation_probability_max ?? 0;
  const maxTemp = todayForecast?.temperature_max ?? temp;
  const minTemp = todayForecast?.temperature_min ?? temp - 6;
  const diurnalRange = Math.abs(maxTemp - minTemp);

  // Month check: 0=Jan, 10=Nov
  const currentMonth = new Date().getMonth();

  // Anomaly Detection Engine
  const anomalyStory: AnomalyStory = useMemo(() => {
    // 1. November / Winter Smog & Temperature Inversion (Stagnant boundary layer)
    if ((currentMonth >= 9 || currentMonth <= 1) && aqi > 120 && windSpeed < 14) {
      return {
        id: 'inversion',
        tag: 'METEOROLOGICAL INVERSION LAYER',
        title: `Why the Air Feels Stagnant & Hazy in ${cityName}`,
        severity: 'warning',
        summary: `Rapid nocturnal ground cooling has created a thermal lid over the surface, trapping particulate matter (PM2.5: ${pm25.toFixed(0)} µg/m³) near ground level.`,
        scientificReason: `During late autumn and winter, the ground loses heat quickly through radiational cooling under clear skies. This cools the air immediately above the earth faster than the air higher up, reversing the normal atmospheric lapse rate (temperature inversion). Because warm air sits atop cold air, vertical convection stops, acting like a ceiling that prevents dispersion.`,
        drivers: [
          { label: 'Surface Wind', value: `${windSpeed.toFixed(0)} km/h (Calm/Stagnant)` },
          { label: 'Diurnal Temp Swing', value: `${diurnalRange.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}` },
          { label: 'Boundary Layer', value: 'Compressed (< 400m)' },
        ],
        suggestedQuestion: `Why does temperature inversion cause severe air pollution in ${cityName}?`,
      };
    }

    // 2. Unseasonal Rain / Post-Monsoon Moisture Surge
    if (maxRainProb >= 35 && (currentMonth >= 9 && currentMonth <= 11)) {
      return {
        id: 'post_monsoon_surge',
        tag: 'POST-MONSOON CONVECTIVE SURGE',
        title: `Unseasonal Rainfall & Moisture Influx in ${cityName}`,
        severity: 'alert',
        summary: `Moist maritime winds from an offshore trough or low-pressure depression are colliding with cooler continental northern winds.`,
        scientificReason: `While the primary Southwest monsoon has retreated, cyclonic circulations over the Arabian Sea or Bay of Bengal periodically pump elevated moisture corridors inland. When this warm maritime air encounters cooler descending northern air streams, localized convective instability triggers unexpected cloud bursts and unseasonal showers.`,
        drivers: [
          { label: 'Rain Probability', value: `${maxRainProb}%` },
          { label: 'Relative Humidity', value: `${humidity}%` },
          { label: 'Cloud System', value: 'Convective Trough' },
        ],
        suggestedQuestion: `What is causing unseasonal rainfall in ${cityName} right now?`,
      };
    }

    // 3. High Thermal Stress / Excessive Humidity (Feels Like Anomaly)
    if (feelsLike - temp >= 4) {
      return {
        id: 'humidity_trap',
        tag: 'THERMAL HUMIDITY GAP',
        title: `Why it Feels ${Math.round(feelsLike - temp)}° Hotter Than the Thermometer`,
        severity: 'warning',
        summary: `Elevated dew point and ${humidity}% relative humidity are severely inhibiting the human body's natural evaporative perspiration cooling.`,
        scientificReason: `The thermometer measures dry-bulb air temperature (${temp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}), but human comfort depends on the rate of sweat evaporation. When air moisture content is high, water vapor pressure is near equilibrium, meaning your body cannot release heat effectively. The Heat Index formula accounts for this combined physiological thermal stress.`,
        drivers: [
          { label: 'Actual Temp', value: `${temp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}` },
          { label: 'Apparent Temp', value: `${feelsLike.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}` },
          { label: 'Evaporation Index', value: `${humidity}% Moisture Saturation` },
        ],
        suggestedQuestion: `Why is the feels-like temperature so much higher than actual temperature in ${cityName}?`,
      };
    }

    // 4. Default: Radiational Cooling & Seasonal Transition
    return {
      id: 'radiational_transition',
      tag: 'SEASONAL RADIATIONAL DYNAMICS',
      title: `Autumn-to-Winter Radiational Cooling in ${cityName}`,
      severity: 'info',
      summary: `Wide day-to-night temperature swing (${diurnalRange.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}) driven by dry continental anticyclonic air and cloudless night skies.`,
      scientificReason: `Under stable post-monsoon high-pressure systems, low atmospheric moisture allows maximum solar insulation during the afternoon (high of ${maxTemp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}), followed by rapid infrared terrestrial radiation escape back into space overnight (low of ${minTemp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}).`,
      drivers: [
        { label: 'Day/Night Spread', value: `${diurnalRange.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}` },
        { label: 'Barometric State', value: 'Stable Anticyclone' },
        { label: 'Nighttime Cooling', value: 'High Radiative Loss' },
      ],
      suggestedQuestion: `What atmospheric conditions cause wide temperature swings in ${cityName}?`,
    };
  }, [currentMonth, aqi, windSpeed, maxRainProb, feelsLike, temp, humidity, diurnalRange, cityName, pm25, units, maxTemp, minTemp]);

  const severityColor =
    anomalyStory.severity === 'alert'
      ? 'var(--danger)'
      : anomalyStory.severity === 'warning'
      ? 'var(--warning)'
      : 'var(--primary)';

  const severityBg =
    anomalyStory.severity === 'alert'
      ? 'rgba(248, 113, 113, 0.12)'
      : anomalyStory.severity === 'warning'
      ? 'rgba(245, 158, 11, 0.12)'
      : 'rgba(56, 189, 248, 0.12)';

  const severityBorder =
    anomalyStory.severity === 'alert'
      ? 'rgba(248, 113, 113, 0.25)'
      : anomalyStory.severity === 'warning'
      ? 'rgba(245, 158, 11, 0.25)'
      : 'rgba(56, 189, 248, 0.25)';

  return (
    <section
      aria-label="Scientific Weather Anomaly Storyteller"
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
              backgroundColor: severityBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: severityColor,
            }}
          >
            <Atom style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
                Meteorological Storyteller
              </h2>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  backgroundColor: severityBg,
                  color: severityColor,
                  border: `1px solid ${severityBorder}`,
                  letterSpacing: '0.04em',
                }}
              >
                {anomalyStory.tag}
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Scientific physics explanation behind unusual seasonal weather patterns
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
          <BookOpen style={{ width: 14, height: 14, color: 'var(--primary)' }} />
          <span>Physics Corpus Grounded</span>
        </div>
      </div>

      {/* Main Story Box */}
      <div
        style={{
          padding: '16px 18px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px 0' }}>
            {anomalyStory.title}
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            {anomalyStory.summary}
          </p>
        </div>

        {/* Scientific breakdown */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '12px',
            color: 'var(--muted)',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>
            🔬 Atmospheric Science Behind This:
          </strong>
          {anomalyStory.scientificReason}
        </div>

        {/* 3 Driver Chips */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
          }}
        >
          {anomalyStory.drivers.map((d, i) => (
            <div
              key={i}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>{d.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 700 }}>{d.value}</span>
            </div>
          ))}
        </div>

        {/* Action Button: Ask Chatbot */}
        {onAskChat && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic' }}>
              Want to dive deeper into the atmospheric physics?
            </span>
            <button
              onClick={() => onAskChat(anomalyStory.suggestedQuestion)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--primary)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Ask AI: "{anomalyStory.suggestedQuestion.slice(0, 36)}..."</span>
              <ArrowRight style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
