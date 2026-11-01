import React, { useState } from 'react';
import { WeatherSnapshot, AirQuality, Location } from '../types/api';

interface EnergyWeatherCardProps {
  location?: Location | null;
  weather?: WeatherSnapshot | null;
  airQuality?: AirQuality | null;
  units?: 'celsius' | 'fahrenheit';
  isLoading?: boolean;
  onAskAI?: (prompt: string) => void;
}

type TabMode = 'ac_load' | 'solar_pv' | 'cabin_oven';

export const EnergyWeatherCard: React.FC<EnergyWeatherCardProps> = ({
  location,
  weather,
  airQuality,
  units = 'celsius',
  isLoading = false,
  onAskAI,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('ac_load');

  if (isLoading || !weather) return null;

  const cityName = location?.name ?? 'Your City';
  const temp = Math.round(weather.temperature);
  const feelsLike = Math.round(weather.apparent_temperature ?? temp);
  const humidity = weather.relative_humidity ?? 50;
  const cloudCover = weather.cloud_cover ?? 10;
  const aqi = Math.round(airQuality?.aqi ?? airQuality?.us_aqi ?? 60);

  // 1. AC Thermal Load Calculation
  // Base cooling degree demand: threshold is 24°C. Humidity adds latent heat burden.
  const tempExcess = Math.max(0, temp - 24);
  const humidityPenalty = humidity > 60 ? (humidity - 60) * 0.4 : 0;
  const acLoadPercent = Math.min(100, Math.round((tempExcess * 4.5) + humidityPenalty + 15));
  const recommendedAcTemp = temp > 36 ? 26 : temp > 30 ? 25 : 24;
  const potentialSavings = Math.min(32, Math.max(8, (recommendedAcTemp - 20) * 6));

  // 2. Solar Rooftop PV Generation Efficiency Calculation
  // Cloud cover directly attenuates light; particulate smog (AQI) scatters sunlight
  const cloudLoss = cloudCover * 0.65;
  const aqiLoss = aqi > 100 ? Math.min(25, (aqi - 100) * 0.12) : 0;
  const solarEfficiency = Math.max(10, Math.min(100, Math.round(100 - cloudLoss - aqiLoss)));
  const estimatedKwhPerKw = (4.8 * (solarEfficiency / 100)).toFixed(1);

  // 3. Vehicle Cabin Oven Factor Calculation
  // In closed parked vehicles, solar greenhouse trapping elevates cabin temp rapidly
  const cabinTemp20Min = temp > 20 ? Math.round(temp + 18 + (cloudCover < 30 ? 6 : 0)) : temp + 8;
  const cabinTemp40Min = temp > 20 ? Math.round(temp + 24 + (cloudCover < 30 ? 8 : 0)) : temp + 12;

  const getLoadBadge = (load: number) => {
    if (load > 75) return { label: 'High Thermal Demand', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
    if (load > 45) return { label: 'Moderate Demand', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' };
    return { label: 'Low Demand', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
  };

  const acBadge = getLoadBadge(acLoadPercent);

  const promptText = `Analyze the current weather in ${cityName} (${temp}°${units === 'celsius' ? 'C' : 'F'}, ${humidity}% humidity, ${cloudCover}% clouds) and suggest the best ways to optimize home energy consumption, AC runtime, and solar generation.`;

  return (
    <section
      aria-label="Energy, AC Load & Solar Rooftop Efficiency Estimator"
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
            <span style={{ fontSize: '18px' }}>⚡</span>
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 700,
                color: '#F8FAFC',
                letterSpacing: '-0.01em',
              }}
            >
              Energy, AC Thermal Load & Solar Yield
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
              Smart Grid & Eco Optimizer
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
            Actionable thermodynamic predictions for household power billing, solar photovoltaic generation & vehicle safety.
          </p>
        </div>

        {/* Global Status Chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: acBadge.bg,
            border: `1px solid ${acBadge.border}`,
            padding: '6px 12px',
            borderRadius: '20px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: acBadge.color,
              boxShadow: `0 0 8px ${acBadge.color}`,
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: acBadge.color }}>
            AC Load: {acLoadPercent}%
          </span>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('ac_load')}
          style={{
            background: activeTab === 'ac_load' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(17, 27, 46, 0.6)',
            border: activeTab === 'ac_load' ? '1px solid #38BDF8' : '1px solid #1E2A44',
            borderRadius: '10px',
            padding: '10px 12px',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px' }}>❄️</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: acBadge.color }}>
              {acLoadPercent}%
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: activeTab === 'ac_load' ? 700 : 500,
              color: activeTab === 'ac_load' ? '#F8FAFC' : '#94A3B8',
            }}
          >
            Air Conditioning Load
          </span>
        </button>

        <button
          onClick={() => setActiveTab('solar_pv')}
          style={{
            background: activeTab === 'solar_pv' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(17, 27, 46, 0.6)',
            border: activeTab === 'solar_pv' ? '1px solid #FBBF24' : '1px solid #1E2A44',
            borderRadius: '10px',
            padding: '10px 12px',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px' }}>☀️</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#10B981' }}>
              {solarEfficiency}% Yield
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: activeTab === 'solar_pv' ? 700 : 500,
              color: activeTab === 'solar_pv' ? '#F8FAFC' : '#94A3B8',
            }}
          >
            Solar Rooftop Yield
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cabin_oven')}
          style={{
            background: activeTab === 'cabin_oven' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(17, 27, 46, 0.6)',
            border: activeTab === 'cabin_oven' ? '1px solid #EF4444' : '1px solid #1E2A44',
            borderRadius: '10px',
            padding: '10px 12px',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '16px' }}>🚗</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444' }}>
              {cabinTemp20Min}°{units === 'celsius' ? 'C' : 'F'}
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: activeTab === 'cabin_oven' ? 700 : 500,
              color: activeTab === 'cabin_oven' ? '#F8FAFC' : '#94A3B8',
            }}
          >
            Vehicle Cabin Oven Risk
          </span>
        </button>
      </div>

      {/* Active Tab Content Panel */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid #1E2A44',
          borderRadius: '12px',
          padding: '16px',
        }}
      >
        {activeTab === 'ac_load' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>❄️</span>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
                  Smart AC Compressor & Thermostat Guide
                </h4>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Outside air is {temp}°{units === 'celsius' ? 'C' : 'F'} with {humidity}% humidity. High ambient moisture increases latent heat load, requiring the AC compressor to cycle longer to extract room moisture.
              </p>

              {/* Progress meter */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                  <span>Cooling Compressor Workload</span>
                  <span style={{ fontWeight: 700, color: acBadge.color }}>{acLoadPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#1E2A44', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${acLoadPercent}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, #10B981, ${acBadge.color})`,
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out',
                    }}
                  />
                </div>
              </div>

              {/* Metric Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(17, 27, 46, 0.8)', border: '1px solid #1E2A44', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Recommended Setpoint</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                    {recommendedAcTemp}°{units === 'celsius' ? 'C' : 'F'}
                  </div>
                </div>
                <div style={{ background: 'rgba(17, 27, 46, 0.8)', border: '1px solid #1E2A44', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Bill Savings Potential</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#10B981', marginTop: '2px' }}>
                    ~{potentialSavings}% reduction
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  💡 Power Saving Action Steps
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#E2E8F0', lineHeight: 1.45 }}>
                  <div>▸ Set AC to <strong>{recommendedAcTemp}°C</strong> with ceiling fan on low speed to maintain equal convective comfort while cutting compressor runtime.</div>
                  <div>▸ Close direct east/south window blinds during 11:00 AM – 3:30 PM to eliminate radiant heat gain.</div>
                  <div>▸ Run dehumidification mode for 20 minutes if room feels sticky before switching to normal cool mode.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'solar_pv' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>☀️</span>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
                  Solar Photovoltaic (PV) Rooftop Yield
                </h4>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Cloud cover is at {cloudCover}% with an AQI of {aqi}. High particulate haze scatters direct solar rays into diffuse irradiance, mildly lowering peak monocrystalline panel efficiency.
              </p>

              {/* Solar meter */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>
                  <span>Photovoltaic Harvest Efficiency</span>
                  <span style={{ fontWeight: 700, color: '#10B981' }}>{solarEfficiency}% of Peak Capacity</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#1E2A44', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${solarEfficiency}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #FBBF24, #10B981)',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease-out',
                    }}
                  />
                </div>
              </div>

              {/* Metric Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(17, 27, 46, 0.8)', border: '1px solid #1E2A44', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Estimated Daily Yield</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#FBBF24', marginTop: '2px' }}>
                    {estimatedKwhPerKw} kWh / kWp
                  </div>
                </div>
                <div style={{ background: 'rgba(17, 27, 46, 0.8)', border: '1px solid #1E2A44', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Peak Generation Window</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>
                    10:30 AM – 3:00 PM
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Appliance Scheduling */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase', marginBottom: '8px' }}>
                ⚡ Appliance Self-Consumption Schedule
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#E2E8F0', lineHeight: 1.45 }}>
                <div>▸ <strong>EV & Battery Charging:</strong> Schedule charging between 11:00 AM and 2:30 PM to utilize 100% free surplus rooftop energy.</div>
                <div>▸ <strong>Heavy Loads:</strong> Run water pumps, dishwashers, and washing machines during midday peak solar altitude.</div>
                <div>▸ <strong>Panel Soiling:</strong> If AQI stays above 120 for 5 consecutive dry days, rinse panels early morning to regain ~12% lost output.</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cabin_oven' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>🚗</span>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#F8FAFC' }}>
                  Parked Vehicle Solar Thermal Accumulation
                </h4>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Due to the greenhouse effect of automotive glass, dark dashboards and enclosed air trap shortwave solar radiation, turning parked car interiors dangerously hot in minutes.
              </p>

              {/* Metric Chips */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(17, 27, 46, 0.8)', border: '1px solid #1E2A44', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10px', color: '#EF4444', textTransform: 'uppercase', fontWeight: 600 }}>Interior at 20 Mins</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#EF4444', marginTop: '2px' }}>
                    {cabinTemp20Min}°{units === 'celsius' ? 'C' : 'F'}
                  </div>
                </div>
                <div style={{ background: 'rgba(17, 27, 46, 0.8)', border: '1px solid #1E2A44', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '10px', color: '#EF4444', textTransform: 'uppercase', fontWeight: 600 }}>Interior at 40 Mins</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#EF4444', marginTop: '2px' }}>
                    {cabinTemp40Min}°{units === 'celsius' ? 'C' : 'F'}
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Protocol */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', marginBottom: '8px' }}>
                ⚠️ Critical Safety Warnings
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#E2E8F0', lineHeight: 1.45 }}>
                <div>▸ <strong>Never leave children or pets</strong> unattended in parked vehicle for even 2 minutes. Heat stroke and hyperthermia occur rapidly.</div>
                <div>▸ <strong>Electronics Hazard:</strong> Do not leave lithium battery power banks, laptops, or lighters in dashboard glove compartments.</div>
                <div>▸ <strong>Ventilation Tip:</strong> Roll down opposite windows for 30 seconds before turning on vehicle AC to purge superheated air instantly.</div>
              </div>
            </div>
          </div>
        )}
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
            Want tailored suggestions to cut your home power bill today?
          </span>
          <button
            onClick={() => onAskAI(promptText)}
            style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#FBBF24',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)';
              e.currentTarget.style.borderColor = '#FBBF24';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.3)';
            }}
          >
            <span>Ask WeatherGPT: "How to minimize my AC bill in {cityName}?"</span>
            <span>→</span>
          </button>
        </div>
      )}
    </section>
  );
};
