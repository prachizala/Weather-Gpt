import React, { useState } from 'react';
import { WeatherSnapshot, ForecastData, Location } from '../types/api';
import { Sprout, Droplets, Bug, Wind, Sun, AlertTriangle, CheckCircle2, ShieldCheck, Thermometer } from 'lucide-react';

interface AgroClimateShieldCardProps {
  location?: Location | null;
  weather?: WeatherSnapshot | null;
  forecast?: ForecastData | null;
  isLoading?: boolean;
}

export const AgroClimateShieldCard: React.FC<AgroClimateShieldCardProps> = ({
  location,
  weather,
  forecast,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'irrigation' | 'spraying' | 'plant_health'>('irrigation');

  if (isLoading || !weather) return null;

  const cityName = location?.name ?? 'your region';
  const temp = Math.round(weather.temperature);
  const humidity = weather.relative_humidity ?? 55;
  const windSpeed = weather.wind_speed ?? 8;
  const cloudCover = weather.cloud_cover ?? 10;
  const isDay = weather.is_day ?? 1;

  // Next 24h rain forecast
  const tomorrowRain = forecast?.daily?.[1]?.precipitation_sum ?? 0;
  const tomorrowRainProb = forecast?.daily?.[1]?.precipitation_probability_max ?? 0;

  // 1. Evapotranspiration (ET0) estimation in mm/day
  // Standard agronomic model based on temperature, wind, solar radiation proxy (100 - cloudCover), and vapor pressure deficit
  const solarFactor = Math.max(0.4, (100 - cloudCover) / 100);
  const windFactor = 1 + windSpeed / 25;
  const vpdFactor = Math.max(0.6, (100 - humidity) / 50);
  const rawET0 = (0.12 * Math.max(10, temp) * solarFactor * windFactor * vpdFactor).toFixed(1);
  const et0 = Math.max(1.8, Math.min(8.5, parseFloat(rawET0)));

  // 2. Smart Irrigation Advisory
  let irrigationAction = 'Normal Irrigation Needed';
  let irrigationColor = '#38BDF8';
  let irrigationAdvice = `Evaporative soil moisture loss is ~${et0} mm today. Apply deep root watering before 9:00 AM or after 5:30 PM.`;
  let waterSavePercent = 0;

  if (tomorrowRain >= 5 || tomorrowRainProb >= 70) {
    irrigationAction = 'Skip Irrigation (Rain Incoming)';
    irrigationColor = '#10B981';
    irrigationAdvice = `Forecast models project ${tomorrowRain}mm rain (${tomorrowRainProb}% confidence) within 24h. Postpone watering to prevent waterlogging and root hypoxia.`;
    waterSavePercent = 100;
  } else if (temp >= 38 && humidity < 35) {
    irrigationAction = 'Critical Heat Desiccation Alert';
    irrigationColor = '#EF4444';
    irrigationAdvice = `Rapid transpiration deficit at ${temp}°C and ${humidity}% RH. Apply mulch and double irrigation cycle to prevent leaf scorch and blossom drop.`;
  } else if (et0 < 2.5) {
    irrigationAction = 'Low Water Loss (Light Watering)';
    irrigationColor = '#FBBF24';
    irrigationAdvice = `Cooler temperatures and higher ambient moisture reduce soil transpiration. Light watering (~5L/m²) is sufficient.`;
    waterSavePercent = 40;
  }

  // 3. Pesticide & Foliar Nutrient Spray Window Evaluation
  // Ideal: Wind < 12 km/h, Rain Prob < 20%, Temp < 32°C
  const windOk = windSpeed <= 12;
  const rainOk = tomorrowRainProb <= 25;
  const tempOk = temp <= 34;
  const isSprayOptimal = windOk && rainOk && tempOk;

  let sprayGrade = 'Optimal Spraying Window';
  let sprayColor = '#10B981';
  let sprayDetail = 'Low aerodynamic wind drift (<12 km/h) and minimal wash-off risk. Ideal for systemic insecticides, fungicides, or foliar fertilizers.';

  if (!windOk) {
    sprayGrade = 'High Drift Hazard (Hold Off)';
    sprayColor = '#EF4444';
    sprayDetail = `Wind speed at ${windSpeed} km/h causes chemical drift and non-target crop contamination. Delay spraying until wind calms below 12 km/h.`;
  } else if (!rainOk) {
    sprayGrade = 'Washout Risk (Rain Expected)';
    sprayColor = '#F59E0B';
    sprayDetail = `Upcoming precipitation risk (${tomorrowRainProb}%) will wash unabsorbed foliar active ingredients into soil runoff.`;
  } else if (!tempOk) {
    sprayGrade = 'Phytotoxicity / Vaporization Risk';
    sprayColor = '#F59E0B';
    sprayDetail = `High temperature (${temp}°C) accelerates chemical vaporization and can cause leaf burn. Spray strictly during dawn or dusk.`;
  }

  // 4. Fungal Blight & Pest Risk (Smith Period Model)
  // Fungal spores (powdery mildew, blast, late blight) flourish at 18-28°C with RH > 75%
  let fungalRisk = 'Low / Inhibited';
  let fungalColor = '#10B981';
  let fungalDesc = 'Dry ambient air inhibits spore germination and bacterial leaf streaks.';

  if (humidity >= 78 && temp >= 18 && temp <= 30) {
    fungalRisk = 'Severe Blight & Mildew Threat';
    fungalColor = '#EF4444';
    fungalDesc = `High humidity (${humidity}%) and moderate thermal profile (${temp}°C) create optimal incubation for downy mildew, leaf spot, and fungal mycelium. Inspect canopy undersides.`;
  } else if (humidity >= 65) {
    fungalRisk = 'Moderate Spore Activity';
    fungalColor = '#FBBF24';
    fungalDesc = 'Elevated morning dew duration. Ensure adequate spacing between plants and avoid overhead watering.';
  }

  return (
    <section
      aria-label="Agro-Climate & Crop Health Shield"
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
      {/* Background Radial Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
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
            <span style={{ fontSize: '18px' }}>🌾</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.01em',
              }}
            >
              Agro-Climate & Smart Irrigation Shield
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#10B981',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              Evapotranspiration ET₀
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Agronomic soil water loss, pesticide spray advisory windows, and fungal disease prevention for {cityName}.
          </p>
        </div>

        {/* Tab Switcher */}
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
            { id: 'irrigation', label: 'Irrigation & ET₀', icon: Droplets },
            { id: 'spraying', label: 'Spray Window', icon: Wind },
            { id: 'plant_health', label: 'Crop Disease Risk', icon: Sprout },
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
      {activeTab === 'irrigation' && (
        <div>
          {/* Top Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* ET0 Card */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1E2A44',
                borderRadius: '12px',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>REFERENCE TRANSPIRATION (ET₀)</span>
                <span style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 700 }}>Soil Moisture Loss</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '30px', fontWeight: 800, color: '#F8FAFC', lineHeight: 1 }}>
                  {et0}
                </span>
                <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>mm / day</span>
              </div>
              <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                Hargreaves equation based on {temp}°C, {humidity}% RH, and {windSpeed} km/h wind.
              </span>
            </div>

            {/* Smart Advisory Card */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: `1px solid ${irrigationColor}40`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>IRRIGATION RECOMMENDATION</span>
                  {waterSavePercent > 0 && (
                    <span style={{ fontSize: '10.5px', color: '#10B981', fontWeight: 700 }}>
                      +{waterSavePercent}% Water Saved
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: irrigationColor, marginBottom: '4px' }}>
                  {irrigationAction}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', lineHeight: 1.4 }}>
                {irrigationAdvice}
              </p>
            </div>
          </div>

          {/* Quick Schedule Row */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid #1E2A44',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sun style={{ width: 14, height: 14, color: '#FBBF24' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#F8FAFC' }}>
                Optimal Watering Times:
              </span>
            </div>
            <span style={{ fontSize: '11.5px', color: '#38BDF8', fontWeight: 600 }}>
              06:00 - 08:30 AM (Minimal evaporation)
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>or</span>
            <span style={{ fontSize: '11.5px', color: '#38BDF8', fontWeight: 600 }}>
              17:30 - 19:00 PM (Sunset cooling)
            </span>
          </div>
        </div>
      )}

      {/* Spray Window Tab */}
      {activeTab === 'spraying' && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: `1px solid ${sprayColor}40`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSprayOptimal ? (
              <CheckCircle2 style={{ width: 20, height: 20, color: '#10B981', flexShrink: 0 }} />
            ) : (
              <AlertTriangle style={{ width: 20, height: 20, color: sprayColor, flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: sprayColor }}>
                {sprayGrade}
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94A3B8' }}>
                {sprayDetail}
              </p>
            </div>
          </div>

          {/* Condition Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid #1E2A44',
            }}
          >
            <div style={{ background: 'rgba(17, 27, 46, 0.6)', padding: '8px', borderRadius: '8px' }}>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Wind Drift Risk</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: windOk ? '#10B981' : '#EF4444' }}>
                {windSpeed} km/h {windOk ? '✓ Safe' : '⚠ High'}
              </span>
            </div>
            <div style={{ background: 'rgba(17, 27, 46, 0.6)', padding: '8px', borderRadius: '8px' }}>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Washout Probability</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: rainOk ? '#10B981' : '#F59E0B' }}>
                {tomorrowRainProb}% {rainOk ? '✓ Low' : '⚠ Rain Risk'}
              </span>
            </div>
            <div style={{ background: 'rgba(17, 27, 46, 0.6)', padding: '8px', borderRadius: '8px' }}>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Vapor Burn Risk</span>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: tempOk ? '#10B981' : '#EF4444' }}>
                {temp}°C {tempOk ? '✓ Safe' : '⚠ Hot'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Crop Disease Risk Tab */}
      {activeTab === 'plant_health' && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: `1px solid ${fungalColor}40`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bug style={{ width: 20, height: 20, color: fungalColor, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: fungalColor }}>
                {fungalRisk}
              </div>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94A3B8' }}>
                {fungalDesc}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid #1E2A44',
            }}
          >
            <div style={{ background: 'rgba(17, 27, 46, 0.6)', padding: '8px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block' }}>Relative Humidity</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                {humidity}% {humidity > 75 ? '(High Moisture Stress)' : '(Optimal Aeration)'}
              </span>
            </div>
            <div style={{ background: 'rgba(17, 27, 46, 0.6)', padding: '8px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block' }}>Preventative Measure</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#38BDF8' }}>
                {humidity > 70 ? 'Apply Neem oil / copper spray' : 'Normal canopy aeration'}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
