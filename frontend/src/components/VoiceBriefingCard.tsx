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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        if (!synthRef.current) return;
        const v = synthRef.current.getVoices();
        if (v && v.length > 0) {
          setAvailableVoices(v);
        }
      };

      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
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

  const phoneticGreetingHi = hour < 12 ? 'Namaste, Suprabhat' : hour < 17 ? 'Namaste, Shubh Dopahar' : 'Namaste, Shubh Sandhya';
  const phoneticGreetingGu = hour < 12 ? 'Namaste, Shubh Savaar' : hour < 17 ? 'Namaste, Shubh Bapor' : 'Namaste, Shubh Saanj';

  // Dynamic Radio Brief Scripts (Authentic Display Scripts)
  const displayScripts = {
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

  // Phonetic Voice Scripts (for speech engines without native Hindi/Gujarati fonts/phonemes)
  const phoneticVoiceScripts = {
    hi: `${phoneticGreetingHi} ${cityName}! Yeh hai aapka tees second ka mausam bulletin. Vartamaan taapmaan ${temp} degree Celsius hai, jo mehsus ${feelsLike} degree jaisa ho raha hai. Aaj ka adhiktam taapmaan ${maxTemp} degree aur nyunatam ${minTemp} degree rehne ki sambhavna hai. ${
      rainProb >= 40
        ? `Aaj chhata saath rakhein, kyunki baarish ki sambhavna ${rainProb} percent hai.`
        : 'Aaj mausam shushk rahega aur baarish ki koi sambhavna nahi hai.'
    } Vayu gunvatta suchkaank yaani AQI ${aqi} hai. Aapka din mangalmay ho!`,

    gu: `${phoneticGreetingGu} ${cityName}! Aa chhe tamaru tees second nu havaamaan bulletin. Haalma taapmaan ${temp} degree chhe, ane mehsus ${feelsLike} degree jaisa laagi rahyu chhe. Aajnu mahattam taapmaan ${maxTemp} degree ane laghutam ${minTemp} degree rehvaani shakyata chhe. ${
      rainProb >= 40
        ? `Aaje varsaad ni shakyata ${rainProb} taka chhe, tethi chhatri saathe raakhvi.`
        : 'Aaje havaamaan saamaanya ane suku raheshe.'
    } Hava gunvatta index ${aqi} chhe. Aapno divas shubh rahe!`,
  };

  const currentDisplayScript = displayScripts[language];

  const handleTogglePlay = () => {
    if (!synthRef.current || !isSupported) return;

    if (isPlaying) {
      synthRef.current.cancel();
      setIsPlaying(false);
      return;
    }

    synthRef.current.cancel(); // Stop any pending speech

    // Ensure voices are fetched
    const voices = synthRef.current.getVoices().length > 0
      ? synthRef.current.getVoices()
      : availableVoices;

    let textToSpeak = currentDisplayScript;
    let selectedVoice: SpeechSynthesisVoice | undefined;
    let langCode = 'en-US';
    let speechRate = 0.95;

    if (language === 'hi') {
      // 1. Look for true Hindi voice
      selectedVoice = voices.find((v) => {
        const l = v.lang.toLowerCase();
        return l.startsWith('hi') || v.name.toLowerCase().includes('hindi');
      });

      if (selectedVoice) {
        textToSpeak = displayScripts.hi;
        langCode = selectedVoice.lang || 'hi-IN';
      } else {
        // Fallback to Indian English voice with natural phonetic Hinglish
        textToSpeak = phoneticVoiceScripts.hi;
        selectedVoice = voices.find(
          (v) => v.lang.toLowerCase().includes('en-in') || v.name.toLowerCase().includes('india')
        ) || voices.find((v) => v.lang.toLowerCase().startsWith('en'));
        langCode = 'en-IN';
        speechRate = 0.9;
      }
    } else if (language === 'gu') {
      // 1. Look for true Gujarati voice
      selectedVoice = voices.find((v) => {
        const l = v.lang.toLowerCase();
        return l.startsWith('gu') || v.name.toLowerCase().includes('gujarati');
      });

      if (selectedVoice) {
        textToSpeak = displayScripts.gu;
        langCode = selectedVoice.lang || 'gu-IN';
      } else {
        // Fallback to Indian voice with natural Gujlish phonetics
        textToSpeak = phoneticVoiceScripts.gu;
        selectedVoice = voices.find(
          (v) => v.lang.toLowerCase().includes('en-in') || v.name.toLowerCase().includes('india')
        ) || voices.find((v) => v.lang.toLowerCase().startsWith('en'));
        langCode = 'en-IN';
        speechRate = 0.9;
      }
    } else {
      selectedVoice = voices.find(
        (v) => v.lang.toLowerCase().includes('en-in') || (v.lang.toLowerCase().startsWith('en') && v.name.includes('Natural'))
      ) || voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      langCode = selectedVoice?.lang || 'en-US';
      speechRate = 1.0;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.lang = langCode;
    utterance.rate = speechRate;
    utterance.pitch = 1.02;

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
          {isPlaying ? `🎙️ "${currentDisplayScript}"` : `Click "Listen Now" to hear your 30s personalized meteorological morning brief.`}
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
