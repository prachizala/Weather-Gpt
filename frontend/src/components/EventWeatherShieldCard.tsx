import React, { useState, useMemo } from 'react';
import { ForecastData, Location, WeatherSnapshot } from '../types/api';
import {
  ShieldAlert,
  Calendar,
  Clock,
  Compass,
  Trophy,
  Car,
  PartyPopper,
  Tent,
  Camera,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface EventWeatherShieldCardProps {
  location: Location | null;
  forecast: ForecastData | null;
  weather: WeatherSnapshot | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
}

interface EventType {
  id: string;
  name: string;
  icon: React.ReactNode;
  rainSensitivity: number; // weight 1-10
  windSensitivity: number; // weight 1-10
  heatSensitivity: number; // weight 1-10
}

const EVENT_PRESETS: EventType[] = [
  { id: 'cricket', name: 'Cricket & Sports', icon: <Trophy style={{ width: 16, height: 16 }} />, rainSensitivity: 9, windSensitivity: 6, heatSensitivity: 8 },
  { id: 'roadtrip', name: 'Drive / Road Trip', icon: <Car style={{ width: 16, height: 16 }} />, rainSensitivity: 7, windSensitivity: 5, heatSensitivity: 4 },
  { id: 'party', name: 'Terrace & Lawn Party', icon: <PartyPopper style={{ width: 16, height: 16 }} />, rainSensitivity: 10, windSensitivity: 8, heatSensitivity: 7 },
  { id: 'camping', name: 'Camping & Trekking', icon: <Tent style={{ width: 16, height: 16 }} />, rainSensitivity: 9, windSensitivity: 9, heatSensitivity: 8 },
  { id: 'drone', name: 'Photo & Drone Shoot', icon: <Camera style={{ width: 16, height: 16 }} />, rainSensitivity: 10, windSensitivity: 9, heatSensitivity: 5 },
  { id: 'marathon', name: 'Marathon & Running', icon: <Activity style={{ width: 16, height: 16 }} />, rainSensitivity: 6, windSensitivity: 5, heatSensitivity: 10 },
];

const TIME_SLOTS = [
  { id: 'morning', label: 'Morning (6 AM - 11 AM)', startHour: 6, endHour: 11 },
  { id: 'afternoon', label: 'Afternoon (12 PM - 4 PM)', startHour: 12, endHour: 16 },
  { id: 'evening', label: 'Evening (5 PM - 9 PM)', startHour: 17, endHour: 21 },
  { id: 'night', label: 'Night (9 PM - 12 AM)', startHour: 21, endHour: 24 },
];

export const EventWeatherShieldCard: React.FC<EventWeatherShieldCardProps> = ({
  location,
  forecast,
  weather,
  units,
  isLoading,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>('cricket');
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(1); // Tomorrow by default
  const [selectedSlotId, setSelectedSlotId] = useState<string>('evening');

  const selectedEvent = useMemo(
    () => EVENT_PRESETS.find((e) => e.id === selectedEventId) || EVENT_PRESETS[0],
    [selectedEventId]
  );

  const selectedSlot = useMemo(
    () => TIME_SLOTS.find((s) => s.id === selectedSlotId) || TIME_SLOTS[2],
    [selectedSlotId]
  );

  const dailyDays = forecast?.daily || [];
  const targetDay = dailyDays[selectedDateIdx] || dailyDays[0];

  // Simulation calculation
  const analysis = useMemo(() => {
    if (!targetDay) return null;

    const rainProb = targetDay.precipitation_probability_max ?? 0;
    const maxTemp = targetDay.temperature_max ?? 30;
    const minTemp = targetDay.temperature_min ?? 20;
    const windSpeed = targetDay.wind_speed_max ?? 12;
    const weatherCode = targetDay.weather_code ?? 0;

    // Filter relevant hourly data if matching target day
    const targetDateStr = targetDay.date;
    const matchingHours = (forecast?.hourly || []).filter((h) => {
      return (
        h.timestamp.startsWith(targetDateStr) &&
        (() => {
          const hour = parseInt(h.timestamp.split('T')[1].split(':')[0], 10);
          return hour >= selectedSlot.startHour && hour <= selectedSlot.endHour;
        })()
      );
    });

    const slotAvgTemp = matchingHours.length
      ? matchingHours.reduce((acc, h) => acc + h.temperature, 0) / matchingHours.length
      : selectedSlot.id === 'afternoon'
      ? maxTemp
      : selectedSlot.id === 'morning'
      ? (maxTemp + minTemp) / 2
      : minTemp + 3;

    const slotMaxRain = matchingHours.length
      ? Math.max(...matchingHours.map((h) => h.precipitation_probability ?? 0))
      : rainProb;

    const slotAvgWind = matchingHours.length
      ? matchingHours.reduce((acc, h) => acc + (h.wind_speed ?? 0), 0) / matchingHours.length
      : windSpeed * 0.8;

    // Disruption score (0 to 100)
    let score = 0;
    score += (slotMaxRain / 100) * selectedEvent.rainSensitivity * 5.5;
    score += (slotAvgWind / 40) * selectedEvent.windSensitivity * 2.5;

    const isHot = units === 'celsius' ? slotAvgTemp > 34 : slotAvgTemp > 93;
    if (isHot) {
      score += selectedEvent.heatSensitivity * 2.5;
    }

    if (weatherCode >= 95) {
      score += 35; // Severe thunderstorm penalty
    }

    const disruptionRisk = Math.min(Math.round(score), 100);

    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    let riskColor = 'var(--success)';
    let riskBg = 'rgba(52, 211, 153, 0.15)';
    let riskBorder = 'rgba(52, 211, 153, 0.3)';
    let riskTitle = 'Prime Conditions (Low Disruption Risk)';

    if (disruptionRisk >= 55) {
      riskLevel = 'high';
      riskColor = 'var(--danger)';
      riskBg = 'rgba(248, 113, 113, 0.15)';
      riskBorder = 'rgba(248, 113, 113, 0.3)';
      riskTitle = 'High Disruption Alert';
    } else if (disruptionRisk >= 25) {
      riskLevel = 'moderate';
      riskColor = 'var(--warning)';
      riskBg = 'rgba(245, 158, 11, 0.15)';
      riskBorder = 'rgba(245, 158, 11, 0.3)';
      riskTitle = 'Moderate Risk (Plan Backup)';
    }

    // Contextual verdict
    let verdict = '';
    let recommendation = '';

    if (riskLevel === 'high') {
      verdict = `Significant disruption expected during the ${selectedSlot.label.toLowerCase()} window. High precipitation probability (${slotMaxRain}%) and gusty wind speeds (~${slotAvgWind.toFixed(0)} km/h) threaten outdoor arrangements.`;
      recommendation = `We advise postponing the outdoor portion or moving to an enclosed venue. If essential, secure canopy pegs and waterproof electronics.`;
    } else if (riskLevel === 'moderate') {
      verdict = `Fairly manageable conditions with minor risks. Precipitation probability sits around ${slotMaxRain}%, with average ambient temperature near ${slotAvgTemp.toFixed(1)}°${units === 'celsius' ? 'C' : 'F'}.`;
      recommendation = `Safe to proceed with caution. Keep an eye on real-time radar ~2 hours prior and have a shaded or dry backup area ready.`;
    } else {
      verdict = `Ideal atmospheric window! Stable barometric conditions, manageable wind (${slotAvgWind.toFixed(0)} km/h), and very low rain chance (${slotMaxRain}%).`;
      recommendation = `Full green light to proceed as planned. Great visibility and pleasant temperatures for outdoor activities.`;
    }

    return {
      disruptionRisk,
      riskLevel,
      riskColor,
      riskBg,
      riskBorder,
      riskTitle,
      slotAvgTemp,
      slotMaxRain,
      slotAvgWind,
      matchingHours,
      verdict,
      recommendation,
    };
  }, [targetDay, selectedEvent, selectedSlot, forecast?.hourly, units]);

  if (isLoading || !forecast) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <div
          className="skeleton"
          style={{
            height: '220px',
            borderRadius: '16px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        />
      </div>
    );
  }

  const formatDayButton = (dateStr: string, idx: number) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      if (idx === 0) return 'Today';
      if (idx === 1) return 'Tomorrow';
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <section
      aria-label="Event Weather Shield and Outdoor Disruption Analyzer"
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
              backgroundColor: 'rgba(251, 191, 36, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <ShieldAlert style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
              Event & Weekend Trip Weather Shield
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Meteorological disruption analysis and optimal timing simulator for outdoor plans in {location?.name ?? 'your city'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
          <Sparkles style={{ width: 14, height: 14, color: 'var(--primary)' }} />
          <span>7-Day Predictive Shield</span>
        </div>
      </div>

      {/* Step 1: Select Event Preset */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
          1. Select Planned Activity / Event:
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
          }}
        >
          {EVENT_PRESETS.map((ev) => {
            const isSelected = ev.id === selectedEventId;
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                aria-pressed={isSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                  color: isSelected ? 'var(--text)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: isSelected ? 'var(--primary)' : 'var(--muted)' }}>{ev.icon}</span>
                <span>{ev.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Date & Time Selector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Date Selector */}
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            2. Choose Day:
          </span>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {dailyDays.slice(0, 5).map((d, idx) => {
              const isSelected = idx === selectedDateIdx;
              return (
                <button
                  key={d.date}
                  onClick={() => setSelectedDateIdx(idx)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg)',
                    color: isSelected ? '#0B1220' : 'var(--text)',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {formatDayButton(d.date, idx)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slot Selector */}
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            3. Time Slot:
          </span>
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {TIME_SLOTS.map((s) => (
              <option key={s.id} value={s.id} style={{ backgroundColor: '#111B2E', color: '#E5EDF7' }}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analysis & Verdict Card */}
      {analysis && (
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg)',
            border: `1px solid ${analysis.riskBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'slideUp 0.2s ease',
          }}
        >
          {/* Top row: Risk Meter + Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: analysis.riskBg,
                  color: analysis.riskColor,
                  border: `1px solid ${analysis.riskBorder}`,
                  letterSpacing: '0.04em',
                }}
              >
                {analysis.disruptionRisk}% RISK
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                {analysis.riskTitle}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--muted)' }}>
              <span>🌡️ ~{analysis.slotAvgTemp.toFixed(1)}°{units === 'celsius' ? 'C' : 'F'}</span>
              <span>🌧️ {analysis.slotMaxRain}% Rain</span>
              <span>💨 {analysis.slotAvgWind.toFixed(0)} km/h Wind</span>
            </div>
          </div>

          {/* Risk Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${analysis.disruptionRisk}%`,
                height: '100%',
                backgroundColor: analysis.riskColor,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Verdict Text */}
          <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            {analysis.verdict}
          </p>

          {/* Shield Recommendation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text)' }}>Actionable Shield Advice: </strong>
              {analysis.recommendation}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
