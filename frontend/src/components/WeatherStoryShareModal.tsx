import React, { useState, useRef } from 'react';
import { WeatherSnapshot, AirQuality, Location, ForecastData } from '../types/api';
import { Share2, Download, Copy, Check, X, Sparkles } from 'lucide-react';

interface WeatherStoryShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  weather: WeatherSnapshot | null;
  airQuality: AirQuality | null;
  forecast: ForecastData | null;
  units: 'celsius' | 'fahrenheit';
}

export const WeatherStoryShareModal: React.FC<WeatherStoryShareModalProps> = ({
  isOpen,
  onClose,
  location,
  weather,
  airQuality,
  forecast,
  units,
}) => {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen || !weather) return null;

  const cityName = location?.name ?? 'Ahmedabad';
  const country = location?.country ?? 'India';
  const temp = Math.round(weather.temperature);
  const feelsLike = Math.round(weather.apparent_temperature ?? temp);
  const humidity = weather.relative_humidity ?? 50;
  const windSpeed = weather.wind_speed ?? 12;
  const aqi = Math.round(airQuality?.aqi ?? airQuality?.us_aqi ?? 60);
  const maxTemp = Math.round(forecast?.daily?.[0]?.temperature_max ?? temp);
  const minTemp = Math.round(forecast?.daily?.[0]?.temperature_min ?? temp - 5);
  const rainProb = forecast?.daily?.[0]?.precipitation_probability_max ?? 0;
  const tempUnit = units === 'celsius' ? '°C' : '°F';

  // Dynamic witty AI weather punchline
  const punchline =
    rainProb > 50
      ? '🌧️ Rain showers inbound! Keep your umbrella close today.'
      : temp > 35
      ? '🔥 Scorching afternoon ahead! Stay hydrated and seek the shade.'
      : temp < 15
      ? '🧥 Crisp winter breeze in the air! Layer up before heading out.'
      : '✨ Gorgeous weather conditions today! Perfect for an outdoor stroll.';

  const formattedShareText = `🌤️ ${cityName}, ${country} Weather Update:
🌡️ ${temp}${tempUnit} (Feels like ${feelsLike}${tempUnit})
📈 High: ${maxTemp}${tempUnit} | Low: ${minTemp}${tempUnit}
💨 Wind: ${windSpeed} km/h | 💧 Humidity: ${humidity}%
🍃 Air Quality: AQI ${aqi}
${punchline}
— Powered by WeatherGPT (https://github.com/prachizala/Wheather-Gpt)`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedShareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy text', e);
    }
  };

  const handleDownloadImage = () => {
    setIsGenerating(true);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background Gradient (Atmospheric Night/Day Oceanic Palette A)
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
    bgGrad.addColorStop(0, '#0B1220');
    bgGrad.addColorStop(0.35, '#111B2E');
    bgGrad.addColorStop(0.7, '#0F172A');
    bgGrad.addColorStop(1, '#070D18');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Glowing atmospheric radial orbs
    const orb1 = ctx.createRadialGradient(200, 300, 20, 200, 300, 500);
    orb1.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    orb1.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = orb1;
    ctx.beginPath();
    ctx.arc(200, 300, 500, 0, Math.PI * 2);
    ctx.fill();

    const orb2 = ctx.createRadialGradient(880, 1400, 20, 880, 1400, 600);
    orb2.addColorStop(0, 'rgba(251, 191, 36, 0.15)');
    orb2.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = orb2;
    ctx.beginPath();
    ctx.arc(880, 1400, 600, 0, Math.PI * 2);
    ctx.fill();

    // 2. WeatherGPT Header Pill
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.roundRect(140, 140, 800, 90, 45);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WEATHERGPT · METEOROLOGICAL INTELLIGENCE', 540, 196);
    ctx.restore();

    // 3. Location Branding
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📍 LIVE WEATHER BULLETIN', 540, 340);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 96px system-ui, sans-serif';
    ctx.fillText(cityName, 540, 460);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 36px system-ui, sans-serif';
    ctx.fillText(`${country} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`, 540, 520);

    // 4. Center Temperature Display
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 240px system-ui, sans-serif';
    ctx.fillText(`${temp}${tempUnit}`, 540, 800);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 44px system-ui, sans-serif';
    ctx.fillText(`Feels like ${feelsLike}${tempUnit} · High ${maxTemp}${tempUnit} / Low ${minTemp}${tempUnit}`, 540, 890);

    // 5. Four Modern Metric Cards Grid
    const cards = [
      { label: 'AIR QUALITY', value: `AQI ${aqi}`, sub: aqi < 100 ? 'Satisfactory' : 'Moderate', color: '#10B981' },
      { label: 'WIND SPEED', value: `${windSpeed} km/h`, sub: 'Gentle Breeze', color: '#38BDF8' },
      { label: 'HUMIDITY', value: `${humidity}%`, sub: 'Relative Moisture', color: '#818CF8' },
      { label: 'RAIN PROB', value: `${rainProb}%`, sub: rainProb > 30 ? 'Rain Likely' : 'Dry Skies', color: '#FBBF24' },
    ];

    cards.forEach((c, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 140 + col * 420;
      const y = 990 + row * 240;

      ctx.save();
      ctx.fillStyle = 'rgba(17, 27, 46, 0.85)';
      ctx.strokeStyle = 'rgba(30, 42, 68, 0.9)';
      ctx.lineWidth = 3;
      ctx.roundRect(x, y, 380, 200, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(c.label, x + 36, y + 54);

      ctx.fillStyle = c.color;
      ctx.font = '900 54px system-ui, sans-serif';
      ctx.fillText(c.value, x + 36, y + 124);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 24px system-ui, sans-serif';
      ctx.fillText(c.sub, x + 36, y + 168);
      ctx.restore();
    });

    // 6. AI Punchline Banner
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 3;
    ctx.roundRect(140, 1530, 800, 160, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(punchline, 540, 1625);
    ctx.restore();

    // 7. Footer Watermark
    ctx.fillStyle = '#64748B';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Generated with WeatherGPT · Accurate Scientific Meteorological RAG', 540, 1790);

    // Download trigger
    const link = document.createElement('a');
    link.download = `WeatherGPT_${cityName}_Story.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setIsGenerating(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Weather in ${cityName} - WeatherGPT`,
          text: formattedShareText,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      handleCopyText();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(135deg, #111B2E 0%, #0B1220 100%)',
          border: '1px solid #1E2A44',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94A3B8',
            cursor: 'pointer',
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38BDF8',
              fontSize: '11px',
              fontWeight: 700,
              marginBottom: '8px',
            }}
          >
            <Sparkles style={{ width: 12, height: 12 }} />
            <span>WEATHER STORY CARD</span>
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#F8FAFC' }}>
            Share Today's Weather
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
            High-res graphic card for WhatsApp Status & Instagram Stories
          </p>
        </div>

        {/* Mini Preview Box */}
        <div
          style={{
            background: 'linear-gradient(145deg, #0F172A 0%, #0B1220 100%)',
            border: '1px solid #1E2A44',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center',
            marginBottom: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {cityName}, {country}
          </div>
          <div style={{ fontSize: '56px', fontWeight: 900, color: '#FFFFFF', margin: '6px 0', lineHeight: 1 }}>
            {temp}{tempUnit}
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>
            Feels like {feelsLike}{tempUnit} · High {maxTemp}{tempUnit} / Low {minTemp}{tempUnit}
          </div>

          {/* Quick 4 Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' }}>
            <div style={{ background: 'rgba(17, 27, 46, 0.7)', borderRadius: '8px', padding: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748B' }}>AIR QUALITY</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>AQI {aqi}</div>
            </div>
            <div style={{ background: 'rgba(17, 27, 46, 0.7)', borderRadius: '8px', padding: '6px' }}>
              <div style={{ fontSize: '10px', color: '#64748B' }}>WIND SPEED</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>{windSpeed} km/h</div>
            </div>
          </div>

          <div
            style={{
              marginTop: '12px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '11px',
              color: '#E2E8F0',
            }}
          >
            {punchline}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Download Image Button */}
          <button
            onClick={handleDownloadImage}
            disabled={isGenerating}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              background: 'linear-gradient(90deg, #0284C7, #38BDF8)',
              border: 'none',
              color: '#0B1220',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
            }}
          >
            <Download style={{ width: 16, height: 16 }} />
            <span>{isGenerating ? 'Rendering Story Card...' : 'Download Story Graphic (PNG)'}</span>
          </button>

          {/* Copy Text / Native Share Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={handleCopyText}
              style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #1E2A44',
                color: '#F8FAFC',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {copied ? <Check style={{ width: 14, height: 14, color: '#10B981' }} /> : <Copy style={{ width: 14, height: 14 }} />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleNativeShare}
              style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #1E2A44',
                color: '#38BDF8',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Share2 style={{ width: 14, height: 14 }} />
              <span>Share App</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
