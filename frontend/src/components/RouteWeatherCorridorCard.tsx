import React, { useState } from 'react';
import { WeatherSnapshot, ForecastData, Location } from '../types/api';
import { Navigation, AlertTriangle, Sun, CloudRain, Wind, Eye, Compass, Clock, ArrowRight } from 'lucide-react';

interface RouteWeatherCorridorCardProps {
  location?: Location | null;
  weather?: WeatherSnapshot | null;
  forecast?: ForecastData | null;
  units?: 'celsius' | 'fahrenheit';
  isLoading?: boolean;
  onAskAI?: (prompt: string) => void;
}

type CorridorPreset = 'ahm_mum' | 'del_jai' | 'mum_pune' | 'blr_mys';

interface WaypointData {
  city: string;
  distanceKm: number;
  etaHours: number;
  tempOffset: number;
  condition: string;
  icon: string;
  rainProb: number;
  visibilityKm: number;
  windSpeedKm: number;
  hazardNote?: string;
}

export const RouteWeatherCorridorCard: React.FC<RouteWeatherCorridorCardProps> = ({
  location,
  weather,
  forecast,
  units = 'celsius',
  isLoading = false,
  onAskAI,
}) => {
  const [selectedRoute, setSelectedRoute] = useState<CorridorPreset>('ahm_mum');
  const [departureTime, setDepartureTime] = useState<'now' | 'morning' | 'afternoon' | 'evening'>('now');

  if (isLoading || !weather) return null;

  const baseTemp = Math.round(weather.temperature);
  const baseWind = Math.round(weather.wind_speed ?? 12);
  const tempUnit = units === 'celsius' ? '°C' : '°F';

  // Preset Route Corridors with Waypoints & Micro-Climates
  const routesData: Record<CorridorPreset, {
    title: string;
    highway: string;
    totalDistance: string;
    driveDuration: string;
    waypoints: WaypointData[];
  }> = {
    ahm_mum: {
      title: 'Ahmedabad ➔ Mumbai',
      highway: 'NH 48 Golden Quadrilateral',
      totalDistance: '525 km',
      driveDuration: '8.5 Hours',
      waypoints: [
        { city: 'Ahmedabad (Origin)', distanceKm: 0, etaHours: 0, tempOffset: 0, condition: 'Clear Continental', icon: '☀️', rainProb: 5, visibilityKm: 10, windSpeedKm: baseWind },
        { city: 'Vadodara Hub', distanceKm: 110, etaHours: 2.0, tempOffset: +1, condition: 'Warm & Dry', icon: '🌤️', rainProb: 8, visibilityKm: 9, windSpeedKm: baseWind + 3 },
        { city: 'Surat Coastal Crossing', distanceKm: 270, etaHours: 4.5, tempOffset: 0, condition: 'High Gulf Moisture', icon: '💨', rainProb: 15, visibilityKm: 7.5, windSpeedKm: baseWind + 8, hazardNote: 'High coastal crosswinds on Narmada & Tapi bridge expressways' },
        { city: 'Vapi / Manor Border', distanceKm: 420, etaHours: 6.8, tempOffset: -2, condition: 'Hilly Shaded Corridor', icon: '⛅', rainProb: 20, visibilityKm: 6.0, windSpeedKm: baseWind + 4, hazardNote: 'Early morning & dusk hill mist reduces visibility to ~5 km' },
        { city: 'Mumbai (Terminus)', distanceKm: 525, etaHours: 8.5, tempOffset: -1, condition: 'Humid Arabian Sea Breeze', icon: '🌊', rainProb: 22, visibilityKm: 8.0, windSpeedKm: baseWind + 10 },
      ],
    },
    del_jai: {
      title: 'Delhi ➔ Jaipur',
      highway: 'Delhi-Mumbai Expressway / NH 48',
      totalDistance: '280 km',
      driveDuration: '4.5 Hours',
      waypoints: [
        { city: 'New Delhi (Origin)', distanceKm: 0, etaHours: 0, tempOffset: -2, condition: 'Hazy Urban Deck', icon: '🌫️', rainProb: 5, visibilityKm: 4.5, windSpeedKm: 8, hazardNote: 'Smog / particulate haze reduction during morning transits' },
        { city: 'Gurugram / Manesar', distanceKm: 45, etaHours: 1.0, tempOffset: -1, condition: 'Urban Heat Island', icon: '🌤️', rainProb: 5, visibilityKm: 5.5, windSpeedKm: 10 },
        { city: 'Rewari / Neemrana', distanceKm: 130, etaHours: 2.2, tempOffset: 0, condition: 'Open Semi-Arid Plains', icon: '☀️', rainProb: 0, visibilityKm: 9.0, windSpeedKm: 14, hazardNote: 'Strong open-plains sun glare during midday hours' },
        { city: 'Shahpura Valley', distanceKm: 215, etaHours: 3.4, tempOffset: +1, condition: 'Aravalli Range Breeze', icon: '🌤️', rainProb: 5, visibilityKm: 10.0, windSpeedKm: 12 },
        { city: 'Jaipur (Terminus)', distanceKm: 280, etaHours: 4.5, tempOffset: +2, condition: 'Dry Desert Air', icon: '☀️', rainProb: 0, visibilityKm: 10.0, windSpeedKm: 11 },
      ],
    },
    mum_pune: {
      title: 'Mumbai ➔ Pune Expressway',
      highway: 'Yashwantrao Chavan Expressway',
      totalDistance: '150 km',
      driveDuration: '2.8 Hours',
      waypoints: [
        { city: 'Navi Mumbai (Start)', distanceKm: 0, etaHours: 0, tempOffset: 0, condition: 'Coastal Humid', icon: '🌤️', rainProb: 15, visibilityKm: 8.0, windSpeedKm: baseWind },
        { city: 'Khopoli Foothills', distanceKm: 70, etaHours: 1.2, tempOffset: -1, condition: 'Valley Transition', icon: '⛅', rainProb: 25, visibilityKm: 6.5, windSpeedKm: 12 },
        { city: 'Khandala / Lonavala Ghat', distanceKm: 95, etaHours: 1.8, tempOffset: -4, condition: 'Micro-Climate Ghat Cloud', icon: '🌧️', rainProb: 40, visibilityKm: 3.5, windSpeedKm: 22, hazardNote: 'Steep ghat incline, sudden cloud fog and reduced wet-tire friction' },
        { city: 'Talegaon Tollway', distanceKm: 125, etaHours: 2.3, tempOffset: -2, condition: 'Deccan Plateau Air', icon: '🌤️', rainProb: 10, visibilityKm: 9.0, windSpeedKm: 14 },
        { city: 'Pune (Terminus)', distanceKm: 150, etaHours: 2.8, tempOffset: -1, condition: 'Cool Plateau Breeze', icon: '☀️', rainProb: 5, visibilityKm: 10.0, windSpeedKm: 10 },
      ],
    },
    blr_mys: {
      title: 'Bengaluru ➔ Mysuru Expressway',
      highway: 'NH 275 Access-Controlled Expressway',
      totalDistance: '145 km',
      driveDuration: '1.8 Hours',
      waypoints: [
        { city: 'Bengaluru (Origin)', distanceKm: 0, etaHours: 0, tempOffset: 0, condition: 'Plateau Pleasant', icon: '🌤️', rainProb: 15, visibilityKm: 8.5, windSpeedKm: 10 },
        { city: 'Bidadi / Ramanagara', distanceKm: 48, etaHours: 0.6, tempOffset: +1, condition: 'Granite Hills Micro-Climate', icon: '☀️', rainProb: 10, visibilityKm: 9.5, windSpeedKm: 12 },
        { city: 'Maddur / Mandya Plain', distanceKm: 95, etaHours: 1.2, tempOffset: +2, condition: 'Sugarcane Basin Heat', icon: '🌤️', rainProb: 20, visibilityKm: 9.0, windSpeedKm: 14, hazardNote: 'Afternoon convective turbulence and sporadic showers' },
        { city: 'Srirangapatna Valley', distanceKm: 130, etaHours: 1.6, tempOffset: +1, condition: 'Cauvery River Moisture', icon: '⛅', rainProb: 22, visibilityKm: 8.0, windSpeedKm: 12 },
        { city: 'Mysuru (Terminus)', distanceKm: 145, etaHours: 1.8, tempOffset: 0, condition: 'Mild Tropical Air', icon: '🌤️', rainProb: 15, visibilityKm: 10.0, windSpeedKm: 10 },
      ],
    },
  };

  const currentCorridor = routesData[selectedRoute];

  // Calculate overall road safety score (0-100)
  const maxRainOnRoute = Math.max(...currentCorridor.waypoints.map((w) => w.rainProb));
  const minVisOnRoute = Math.min(...currentCorridor.waypoints.map((w) => w.visibilityKm));
  let safetyScore = 100 - (maxRainOnRoute * 0.5) - ((10 - minVisOnRoute) * 3);
  safetyScore = Math.max(30, Math.min(100, Math.round(safetyScore)));

  const getSafetyBadge = (score: number) => {
    if (score >= 85) return { label: 'Optimal Highway Conditions', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
    if (score >= 65) return { label: 'Moderate Caution · Watch Glare/Mist', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)' };
    return { label: 'High Caution · Reduced Wet Grip', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
  };

  const safetyBadge = getSafetyBadge(safetyScore);

  const promptText = `Analyze the driving weather for the ${currentCorridor.title} (${currentCorridor.highway}, ${currentCorridor.totalDistance}) road trip today. Detail expected weather at each stop, sun glare timing, and safety recommendations.`;

  return (
    <section
      aria-label="Highway Route & Travel Micro-Climate Corridor Radar"
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
      {/* Top Header */}
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
            <span style={{ fontSize: '18px' }}>🚗</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.01em',
              }}
            >
              Highway Travel Micro-Climate Corridor
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
              Route Weather Simulation
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Multi-stop weather progression, visibility corridors, and crosswind hazard forecast for road trip routes.
          </p>
        </div>

        {/* Global Safety Rating Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: safetyBadge.bg,
            border: `1px solid ${safetyBadge.color}40`,
            padding: '6px 12px',
            borderRadius: '20px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: safetyBadge.color,
              boxShadow: `0 0 8px ${safetyBadge.color}`,
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: safetyBadge.color }}>
            Route Safety: {safetyScore}/100
          </span>
        </div>
      </div>

      {/* Corridor Preset Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {(['ahm_mum', 'del_jai', 'mum_pune', 'blr_mys'] as CorridorPreset[]).map((key) => {
          const item = routesData[key];
          const isSelected = selectedRoute === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedRoute(key)}
              style={{
                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(17, 27, 46, 0.6)',
                border: isSelected ? '1px solid #38BDF8' : '1px solid #1E2A44',
                borderRadius: '10px',
                padding: '8px 12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? '#38BDF8' : '#F8FAFC',
                }}
              >
                {item.title}
              </span>
              <span style={{ fontSize: '10px', color: '#64748B' }}>
                {item.totalDistance} · {item.driveDuration}
              </span>
            </button>
          );
        })}
      </div>

      {/* Route Metadata Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid #1E2A44',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation style={{ width: 14, height: 14, color: '#38BDF8' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#F8FAFC' }}>
            {currentCorridor.highway}
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            ({currentCorridor.totalDistance} non-stop)
          </span>
        </div>

        {/* Departure Window Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clock style={{ width: 12, height: 12, color: '#94A3B8' }} />
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Departure:</span>
          {(['now', 'morning', 'afternoon', 'evening'] as const).map((dep) => (
            <button
              key={dep}
              onClick={() => setDepartureTime(dep)}
              style={{
                background: departureTime === dep ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                border: departureTime === dep ? '1px solid #38BDF8' : 'none',
                color: departureTime === dep ? '#38BDF8' : '#64748B',
                fontSize: '11px',
                fontWeight: departureTime === dep ? 700 : 500,
                padding: '2px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {dep === 'now' ? 'Depart Now' : dep.charAt(0).toUpperCase() + dep.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Waypoints Horizontal / Vertical Stepper */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        {currentCorridor.waypoints.map((wp, idx) => {
          const wpTemp = baseTemp + wp.tempOffset;
          const isStart = idx === 0;
          const isEnd = idx === currentCorridor.waypoints.length - 1;

          return (
            <div
              key={idx}
              style={{
                background: 'rgba(17, 27, 46, 0.8)',
                border: isStart
                  ? '1px solid rgba(56, 189, 248, 0.4)'
                  : isEnd
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : '1px solid #1E2A44',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              {/* Waypoint Header */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: isStart ? '#38BDF8' : isEnd ? '#10B981' : '#94A3B8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {isStart ? '● Origin' : isEnd ? '🏁 Final Stop' : `Km ${wp.distanceKm}`}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
                    +{wp.etaHours}h ETA
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC', marginBottom: '2px' }}>
                  {wp.city}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0' }}>
                  <span style={{ fontSize: '18px' }}>{wp.icon}</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
                    {wpTemp}{tempUnit}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{wp.condition}</span>
                </div>
              </div>

              {/* Waypoint Driving Parameters */}
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94A3B8', marginBottom: '3px' }}>
                  <span>Visibility:</span>
                  <span style={{ fontWeight: 600, color: wp.visibilityKm < 6 ? '#FBBF24' : '#E2E8F0' }}>
                    {wp.visibilityKm} km
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#94A3B8' }}>
                  <span>Wind / Gust:</span>
                  <span style={{ fontWeight: 600, color: '#E2E8F0' }}>
                    {wp.windSpeedKm} km/h
                  </span>
                </div>

                {wp.hazardNote && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      fontSize: '9.5px',
                      color: '#FBBF24',
                      lineHeight: 1.3,
                    }}
                  >
                    ⚠️ {wp.hazardNote}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver Highway Advisory Banner */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid #1E2A44',
          borderRadius: '10px',
          padding: '12px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Sun style={{ width: 14, height: 14, color: '#FBBF24', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase' }}>
              Sun Glare Driving Advisory
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', lineHeight: 1.4 }}>
              Driving South-West during 4:45 PM – 6:15 PM will align directly with low sun angle. Polarized sunglasses recommended to counter reflective road glare.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <CloudRain style={{ width: 14, height: 14, color: '#38BDF8', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase' }}>
              Road Surface Friction
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', lineHeight: 1.4 }}>
              Main highway asphalt is predominantly dry. Maintain standard safe 3-second braking buffer. No hydroplaning risk detected.
            </div>
          </div>
        </div>
      </div>

      {/* AI Highway Consultation Trigger */}
      {onAskAI && (
        <div
          style={{
            marginTop: '14px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
            Planning a custom route or night drive on this corridor?
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
            <span>Ask WeatherGPT: "Analyze driving conditions on {currentCorridor.title}"</span>
            <span>→</span>
          </button>
        </div>
      )}
    </section>
  );
};
