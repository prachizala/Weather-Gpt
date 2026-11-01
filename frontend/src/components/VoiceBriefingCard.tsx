import React, { useState, useEffect, useRef } from 'react';
import { WeatherSnapshot, ForecastData, AirQuality, Location } from '../types/api';
import {
  Volume2,
  VolumeX,
  Play,
  Square,
  Radio,
  Sparkles,
  Globe,
  Share2
} from 'lucide-react';

interface VoiceBriefingCardProps {
  location: Location | null;
  weather: WeatherSnapshot | null;
  forecast: ForecastData | null;
  airQuality: AirQuality | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
}

export const VoiceBriefingCard: React.FC<VoiceBriefingCardProps> = ({
  location,
  weather,
  forecast,
  airQuality,
  units,
  isLoading,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'hi' | 'gu'>('en');
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  if (isLoading || !weather) return null;

  const cityName = location?.name ?? 'your city';
  const temp = Math.round(weather.temperature);
  const feelsLike = Math.round(weather.apparent_temperature ?? temp);
  const maxTemp = Math.round(forecast?.daily?.[0]?.temperature_max ?? temp);
  const minTemp = Math.round(forecast?.daily?.[0]?.temperature_min ?? temp - 5);
  const rainProb = forecast?.daily?.[0]?.precipitation_probability_max ?? 0;
  const aqi = Math.round(airQuality?.aqi ?? airQuality?.us_aqi ?? 65);
  const tempSymbol = `degrees ${units === 'celsius' ? 'Celsius' : 'Fahrenheit'}`;

  // Time of day greeting
  const hour = new Date().getHours();
  const timeGreetingEn = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const timeGreetingHi = hour < 12 ? 'सुप्रभात' : hour < 17 ? 'शुभ दोपहर' : 'शुभ संध्या';
  const timeGreetingGu = hour < 12 ? 'શુભ સવાર' : hour < 17 ? 'શુભ બપોર' : 'શુભ સાંજ';

  // Dynamic Radio Brief Scripts
  const scripts = {
    en: `${timeGreetingEn} ${cityName}! Here is your 30-second meteorological briefing. Currently it is ${temp} ${tempSymbol}, feeling like ${feelsLike}. Today's high will reach ${maxTemp} with an overnight low of ${minTemp}. ${
      rainProb >= 40
        ? `Keep an umbrella handy, as there is a ${rainProb} percent chance of rain.`
        : 'Dry conditions will prevail with zero significant rain expected.'
    } Air quality is currently at AQI ${aqi}. Have a productive and wonderful day ahead!`,

    hi: `${timeGreetingHi} ${cityName}! यह है आपका 30 सेकंड का मौसम बुलेटिन। वर्तमान तापमान ${temp} डिग्री सेल्सियस है, जो महसूस ${feelsLike} डिग्री जैसा हो रहा है। आज का अधिकतम तापमान ${maxTemp} डिग्री और न्यूनतम ${minTemp} डिग्री रहने की संभावना है। ${
      rainProb >= 40
        ? `आज छाता साथ रखें, क्योंकि बारिश की संभावना ${rainProb} प्रतिशत है।`
        : 'आज मौसम शुष्क रहेगा और बारिश की कोई संभावना नहीं है।'
    } वायु गुणवत्ता सूचकांक यानी एक्यूआई ${aqi} है। आपका आज का दिन मंगलमय हो!`,

    gu: `${timeGreetingGu} ${cityName}! આ છે તમારું 30 સેકન્ડનું હવામાન બુલેટિન. હાલમાં તાપમાન ${temp} ડિગ્રી છે. આજના દિવસનું મહત્તમ તાપમાન ${maxTemp} ડિગ્રી અને લઘુત્તમ ${minTemp} ડિગ્રી રહેવાની શક્યતા છે. ${
      rainProb >= 40
        ? `આજે વરસાદની શક્યતા ${rainProb} ટકા છે, તેથી છત્રી સાથે રાખવી.`
        : 'આજે હવામાન સામાન્ય અને સૂકું રહેશે.'
    } હવા ગુણવત્તા સૂચકાંક ${aqi} છે. આપનો દિવસ શુભ રહે!`,
  };

  const currentScript = scripts[language];

  const handleTogglePlay = () => {
    if (!synthRef.current || !isSupported) return;

    if (isPlaying) {
      synthRef.current.cancel();
      setIsPlaying(false);
      return;
    }

    synthRef.current.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(currentScript);

    // Pick appropriate voice
    const voices = synthRef.current.getVoices();
    if (language === 'hi') {
      const hiVoice = voices.find((v) => v.lang.includes('hi') || v.lang.includes('IN'));
      if (hiVoice) utterance.voice = hiVoice;
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
    } else if (language === 'gu') {
      const guVoice = voices.find((v) => v.lang.includes('gu') || v.lang.includes('IN'));
      if (guVoice) utterance.voice = guVoice;
      utterance.lang = 'gu-IN';
      utterance.rate = 0.95;
    } else {
      const enVoice = voices.find(
        (v) => v.lang.includes('en-IN') || (v.lang.includes('en') && v.name.includes('Natural'))
      ) || voices.find((v) => v.lang.includes('en'));
      if (enVoice) utterance.voice = enVoice;
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
    }

    utterance.pitch = 1.05;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    synthRef.current.speak(utterance);
    setIsPlaying(true);
  };

  return (
    <section
      aria-label="30-Second Morning Voice Weather Briefing"
      style={{
        borderRadius: '16px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '16px 20px',
        marginBottom: '20px',
        background: 'linear-gradient(135deg, rgba(17, 27, 46, 0.95) 0%, rgba(14, 23, 42, 0.9) 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Left: Badge & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: isPlaying ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPlaying ? 'var(--primary)' : 'var(--accent)',
              transition: 'all 0.3s ease',
            }}
          >
            <Radio style={{ width: 18, height: 18, animation: isPlaying ? 'pulse 1.5s infinite' : 'none' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
                30-Second Morning Audio Briefing
              </h3>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(251, 191, 36, 0.15)',
                  color: 'var(--accent)',
                  letterSpacing: '0.04em',
                }}
              >
                RADIO AI
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
              Friendly voice bulletin for {cityName} with live temps, rain chance & air quality
            </p>
          </div>
        </div>

        {/* Right: Controls & Language */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Language Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              padding: '2px',
            }}
          >
            {(['en', 'hi', 'gu'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  if (isPlaying && synthRef.current) synthRef.current.cancel();
                  setIsPlaying(false);
                  setLanguage(lang);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: language === lang ? 'var(--primary)' : 'transparent',
                  color: language === lang ? '#0B1220' : 'var(--muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'HI' : 'GU'}
              </button>
            ))}
          </div>

          {/* Play / Stop Button */}
          <button
            onClick={handleTogglePlay}
            disabled={!isSupported}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: isPlaying ? 'var(--danger)' : 'var(--primary)',
              color: '#0B1220',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: isSupported ? 'pointer' : 'not-allowed',
              opacity: isSupported ? 1 : 0.6,
              transition: 'all 0.2s ease',
              boxShadow: isPlaying ? '0 0 12px rgba(248, 113, 113, 0.4)' : '0 0 12px rgba(56, 189, 248, 0.25)',
            }}
          >
            {isPlaying ? (
              <>
                <Square style={{ width: 14, height: 14, fill: '#0B1220' }} />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play style={{ width: 14, height: 14, fill: '#0B1220' }} />
                <span>Listen Now</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animated Soundwave & Transcript Subtitles */}
      <div
        style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Waveform bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '18px', flexShrink: 0 }}>
          {[8, 14, 18, 10, 16, 22, 12, 18, 14, 8].map((h, i) => (
            <span
              key={i}
              style={{
                width: '3px',
                height: isPlaying ? `${Math.max(6, (h * Math.sin((i + 1) * 0.8)) + 12)}px` : '4px',
                backgroundColor: isPlaying ? 'var(--primary)' : 'var(--muted)',
                borderRadius: '2px',
                transition: 'height 0.2s ease',
                animation: isPlaying ? `wave 1s ease-in-out infinite alternate ${i * 0.1}s` : 'none',
              }}
            />
          ))}
        </div>

        {/* Live Subtitle Transcript */}
        <p
          style={{
            fontSize: '11px',
            color: isPlaying ? 'var(--text)' : 'var(--muted)',
            lineHeight: 1.45,
            margin: 0,
            fontStyle: isPlaying ? 'normal' : 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {isPlaying ? `🎙️ "${currentScript}"` : `Click "Listen Now" to hear your 30s personalized meteorological morning brief.`}
        </p>
      </div>

      <style>{`
        @keyframes wave {
          0% { height: 4px; }
          100% { height: 18px; }
        }
      `}</style>
    </section>
  );
};
