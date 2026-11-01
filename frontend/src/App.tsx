import React, { useState, useEffect } from 'react';
import { Location, WeatherSnapshot, ForecastData, AirQuality, AdvisoriesReport } from './types/api';
import { api } from './services/api';
import { CitySearch } from './components/CitySearch';
import { CurrentConditionsCard } from './components/CurrentConditionsCard';
import { ForecastCards } from './components/ForecastCards';
import { WeatherCharts } from './components/WeatherCharts';
import { AirQualityCard } from './components/AirQualityCard';
import { LifestyleIntelligenceCard } from './components/LifestyleIntelligenceCard';
import { EventWeatherShieldCard } from './components/EventWeatherShieldCard';
import { VoiceBriefingCard } from './components/VoiceBriefingCard';
import { WeatherAnomalyCard } from './components/WeatherAnomalyCard';
import { WindStreamlineCard } from './components/WindStreamlineCard';
import { BiometeorologyCard } from './components/BiometeorologyCard';
import { PrecipitationNowcastCard } from './components/PrecipitationNowcastCard';
import { EnergyWeatherCard } from './components/EnergyWeatherCard';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { ChatPanel } from './components/ChatPanel';
import { AdvisoriesBanner } from './components/AdvisoriesBanner';
import { HistoricalComparisonCard } from './components/HistoricalComparisonCard';
import WeatherBackground from './components/WeatherBackground';

const DEFAULT_LOCATION: Location = {
  name: 'Ahmedabad',
  country: 'India',
  country_code: 'IN',
  admin1: 'Gujarat',
  coordinates: { latitude: 23.0225, longitude: 72.5714 },
  timezone: 'Asia/Kolkata',
  provider: 'open-meteo',
  retrieved_at: new Date().toISOString(),
  units: { temperature: '°C' }
};

export const App: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<Location>(() => {
    const saved = localStorage.getItem('weathergpt_location');
    return saved ? JSON.parse(saved) : DEFAULT_LOCATION;
  });

  const [units, setUnits] = useState<'celsius' | 'fahrenheit'>('celsius');
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [advisories, setAdvisories] = useState<AdvisoriesReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('weathergpt_location', JSON.stringify(selectedLocation));
  }, [selectedLocation]);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);
      const { latitude, longitude } = selectedLocation.coordinates;

      try {
        const [w, f, aqi, adv] = await Promise.all([
          api.getCurrentWeather(latitude, longitude, units),
          api.getForecast(latitude, longitude, 7, units),
          api.getAirQuality(latitude, longitude),
          api.getAdvisories(latitude, longitude, units, selectedLocation.name),
        ]);

        if (!isCancelled) {
          setWeather(w);
          setForecast(f);
          setAirQuality(aqi);
          setAdvisories(adv);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Data loading error:', err);
          setErrorMessage(err.message || 'Unable to load meteorological data from backend.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => { isCancelled = true; };
  }, [selectedLocation, units]);

  const toggleUnits = () => {
    setUnits((prev) => (prev === 'celsius' ? 'fahrenheit' : 'celsius'));
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Animated weather background — fixed behind everything */}
      <WeatherBackground
        weatherCode={weather?.weather_code ?? null}
        isDay={weather?.is_day ?? 1}
        windSpeed={weather?.wind_speed ?? 0}
        timezone={weather?.timezone ?? selectedLocation.timezone}
        forceMode="auto"
      />

      {/* All content sits above the background */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ─── HEADER ─────────────────────────────────────────────────── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            padding: '0 24px',
            backgroundColor: 'rgba(17, 27, 46, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Main header row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 0',
          }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: '8px',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px',
              }}>
                🌤
              </div>
              <div>
                <h1 style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  color: 'var(--text)',
                  letterSpacing: '-0.3px',
                  lineHeight: 1,
                  margin: 0,
                }}>
                  Weather<span style={{ color: 'var(--primary)' }}>GPT</span>
                </h1>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: 2, margin: 0 }}>
                  Meteorological Intelligence · <span style={{ opacity: 0.85 }}>App suggestion, not an official warning (<a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>check IMD ↗</a>)</span>
                </p>
              </div>
            </div>

            {/* City Search */}
            <div style={{ flex: 1, maxWidth: 420 }}>
              <CitySearch
                selectedLocation={selectedLocation}
                onSelectLocation={(loc) => setSelectedLocation(loc)}
              />
            </div>

            {/* Right section: PWA Install & Units toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PwaInstallBanner />
              <button
                onClick={toggleUnits}
                aria-label={`Switch to ${units === 'celsius' ? 'Fahrenheit' : 'Celsius'}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                  fontWeight: '700',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                °{units === 'celsius' ? 'C → °F' : 'F → °C'}
              </button>
            </div>
          </div>
        </header>

        {/* ─── SYSTEM STATUS BARS ─────────────────────────────────────── */}
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px' }}>
          {isOffline && (
            <div style={{
              marginTop: 12,
              padding: '10px 16px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10,
              color: '#fca5a5',
              fontSize: 13,
              fontWeight: 600,
              animation: 'slideUp 0.3s ease',
            }}>
              🔌 You are currently offline. Displaying cached data if available.
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: '12px 18px',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 12,
                color: '#fca5a5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: 13,
                animation: 'slideUp 0.3s ease',
              }}
            >
              <span>🚨 {errorMessage}</span>
              <button
                onClick={() => setSelectedLocation({ ...selectedLocation })}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ─── ADVISORIES BANNER ──────────────────────────────────── */}
          <div style={{ marginTop: 16 }}>
            <AdvisoriesBanner report={advisories} loading={isLoading} />
          </div>

          {/* ─── MAIN TWO-COLUMN GRID ───────────────────────────────── */}
          <main
            style={{
              marginTop: 24,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
              gap: 24,
            }}
          >
            {/* LEFT: Current conditions, Lifestyle intelligence, AQI, Forecast, Charts */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <CurrentConditionsCard
                location={selectedLocation}
                weather={weather}
                units={units}
                onToggleUnits={toggleUnits}
                isLoading={isLoading}
              />

              <VoiceBriefingCard
                location={selectedLocation}
                weather={weather}
                forecast={forecast}
                airQuality={airQuality}
                units={units}
                isLoading={isLoading}
              />

              <LifestyleIntelligenceCard
                weather={weather}
                forecast={forecast}
                airQuality={airQuality}
                units={units}
                isLoading={isLoading}
              />

              <EventWeatherShieldCard
                location={selectedLocation}
                forecast={forecast}
                weather={weather}
                units={units}
                isLoading={isLoading}
              />

              <WeatherAnomalyCard
                location={selectedLocation}
                weather={weather}
                forecast={forecast}
                airQuality={airQuality}
                units={units}
                isLoading={isLoading}
                onAskChat={(question) => {
                  window.dispatchEvent(new CustomEvent('weathergpt:ask-ai', { detail: { prompt: question } }));
                }}
              />

              <WindStreamlineCard
                location={selectedLocation}
                weather={weather}
                units={units}
                isLoading={isLoading}
              />

              <BiometeorologyCard
                current={weather}
                airQuality={airQuality}
                cityName={selectedLocation.name}
                onAskAI={(prompt) => {
                  window.dispatchEvent(new CustomEvent('weathergpt:ask-ai', { detail: { prompt } }));
                }}
              />

              <PrecipitationNowcastCard
                weather={weather}
                forecast={forecast}
                cityName={selectedLocation.name}
                units={units}
                isLoading={isLoading}
                onAskAI={(prompt) => {
                  window.dispatchEvent(new CustomEvent('weathergpt:ask-ai', { detail: { prompt } }));
                }}
              />

              <EnergyWeatherCard
                location={selectedLocation}
                weather={weather}
                airQuality={airQuality}
                units={units}
                isLoading={isLoading}
                onAskAI={(prompt) => {
                  window.dispatchEvent(new CustomEvent('weathergpt:ask-ai', { detail: { prompt } }));
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <AirQualityCard airQuality={airQuality} isLoading={isLoading} />
                </div>
              </div>

              <ForecastCards forecast={forecast} units={units} isLoading={isLoading} />

              <div className="glass" style={{ borderRadius: 20, overflow: 'hidden' }}>
                <WeatherCharts forecast={forecast} units={units} isLoading={isLoading} />
              </div>
            </section>

            {/* RIGHT: Chat assistant */}
            <section
              aria-label="Grounded AI Conversational Assistant"
              style={{ position: 'sticky', top: 100, alignSelf: 'start', minWidth: 0 }}
            >
              <ChatPanel selectedLocation={selectedLocation} units={units} />
            </section>
          </main>

          {/* ─── HISTORICAL COMPARISON ──────────────────────────────── */}
          <div style={{ marginTop: 28 }}>
            <HistoricalComparisonCard
              location={selectedLocation}
              units={units}
              apiClient={api}
            />
          </div>

          {/* ─── FOOTER ─────────────────────────────────────────────── */}
          <footer
            className="glass"
            style={{
              marginTop: 48,
              padding: '20px 28px',
              borderRadius: 16,
              marginBottom: 32,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}
          >
            <p>
              Weather data:{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo.com
              </a>{' '}
              (CC BY 4.0) · Air quality:{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo Air Quality API
              </a>
            </p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              ⚠️ <strong>Non-commercial educational use only.</strong> Not a substitute for official meteorological advisories.
              Always check{' '}
              <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">
                IMD
              </a>{' '}
              for authoritative forecasts.
            </p>
          </footer>
        </div>
      </div>

      {/* ─── RESPONSIVE STYLES ───────────────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          main {
            grid-template-columns: 1fr !important;
          }
          section[aria-label="Grounded AI Conversational Assistant"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
};
