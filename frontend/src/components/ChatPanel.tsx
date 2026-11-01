import React, { useState, useRef, useEffect } from 'react';
import { Location, SourceRef } from '../types/api';
import { api } from '../services/api';

interface ChatPanelProps {
  selectedLocation: Location | null;
  units: 'celsius' | 'fahrenheit';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRef[];
  knowledge_citations?: SourceRef[];
  limitations?: string[];
  isStreaming?: boolean;
}

const SUGGESTED_QUESTIONS = {
  en: [
    'Will it rain tomorrow in Ahmedabad?',
    'Why does it feel hotter than the temperature today?',
    'What is the difference between weather and climate?',
    'What is the 7-day temperature trend?',
  ],
  hi: [
    'क्या कल अहमदाबाद में बारिश होगी?',
    'आज तापमान से ज्यादा गर्मी क्यों लग रही है?',
    'मौसम और जलवायु में क्या अंतर है?',
  ],
  gu: [
    'શું આવતીકાલે અમદાવાદમાં વરસાદ પડશે?',
    'આજે તાપમાન કરતાં વધુ ગરમી કેમ લાગે છે?',
    'હવામાન અને આબોહવા વચ્ચે શું તફાવત છે?',
  ],
};

const LANG_LABELS: Record<string, string> = { en: '🇬🇧 EN', hi: '🇮🇳 HI', gu: '🇮🇳 GU' };

export const ChatPanel: React.FC<ChatPanelProps> = ({ selectedLocation, units }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi' | 'gu'>('en');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the newest message
  useEffect(() => {
    if (messages.length > 0 || isSubmitting) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSubmitting]);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || input).trim();
    if (!textToSend || isSubmitting) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    textareaRef.current?.focus();

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: textToSend },
      { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
    ]);
    setIsSubmitting(true);

    let accumulatedAnswer = '';

    try {
      await api.streamChatMessage(
        textToSend,
        'frontend-session',
        units,
        (token) => {
          accumulatedAnswer += token;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulatedAnswer } : msg
            )
          );
        },
        (meta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    sources: meta.sources,
                    knowledge_citations: meta.knowledge_citations,
                    limitations: meta.limitations,
                    isStreaming: false,
                  }
                : msg
            )
          );
        },
        selectedLocation
      );
    } catch (err: any) {
      console.error('Chat error:', err);
      try {
        const fallback = await api.sendChatMessage(
          textToSend,
          'frontend-session',
          units,
          selectedLocation
        );
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: fallback.answer,
                  sources: fallback.sources,
                  knowledge_citations: fallback.knowledge_citations,
                  limitations: fallback.limitations,
                  isStreaming: false,
                }
              : msg
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `⚠️ Connection error: ${err.message || 'Unable to reach the meteorological backend.'}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } finally {
      setIsSubmitting(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: allow default newline insertion
        return;
      }
      // Enter without Shift: trigger send
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const isSendDisabled = isSubmitting || !input.trim();

  return (
    <div className="chat-panel-container glass">
      {/* ── Panel Header ──────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 9, height: 9 }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: 'var(--success)',
              animation: 'pulseRing 1.8s ease-out infinite',
            }} />
            <div style={{
              width: 9, height: 9,
              borderRadius: '50%',
              background: 'var(--success)',
              position: 'relative',
            }} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, margin: 0 }}>
              WeatherGPT Assistant
            </h3>
            <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
              Grounded · Verified · Multilingual
            </span>
          </div>
        </div>

        {/* Language selector */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            backgroundColor: 'var(--bg)',
            padding: '3px',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
          role="group"
          aria-label="Select response language"
        >
          {(['en', 'hi', 'gu'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              aria-pressed={language === lang}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: '0.6875rem',
                fontWeight: 700,
                transition: 'all 0.2s',
                backgroundColor: language === lang
                  ? 'var(--primary)'
                  : 'transparent',
                color: language === lang ? '#0B1220' : 'var(--muted)',
                border: 'none',
              }}
            >
              {LANG_LABELS[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Suggested Question Chips: Flex wrap onto multiple lines ── */}
      <div className="suggestions-wrap-container">
        <span style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--muted)',
          letterSpacing: '0.05em',
          marginRight: 4,
          flexShrink: 0
        }}>
          SUGGESTED:
        </span>
        {SUGGESTED_QUESTIONS[language].map((q, i) => (
          <button
            key={i}
            onClick={() => handleSend(q)}
            className="suggest-chip"
            style={{
              whiteSpace: 'normal',
              textAlign: 'left',
              lineHeight: 1.35,
              fontSize: '0.75rem',
              padding: '5px 11px',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── Message History: internal scrolling area ───────────────── */}
      <div
        className="chat-scroll-area"
        style={{
          flex: 1,
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--muted)',
              marginTop: 40,
              animation: 'fadeIn 0.5s ease',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌦️</div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Ask meteorological questions
            </p>
            <p style={{ fontSize: '0.8125rem' }}>
              e.g. <em style={{ color: 'var(--primary)' }}>"Will it rain tomorrow in {selectedLocation?.name ?? 'Ahmedabad'}?"</em>
            </p>
            <p style={{ fontSize: '0.75rem', marginTop: 6 }}>
              Factually verified using Open-Meteo & scientific atmospheric corpus.
            </p>
          </div>
        )}

        {messages.map((m) => {
          // Separate IMD notices from general limitations
          const rawLimitations = m.limitations || [];
          const imdNotices = rawLimitations.filter(
            (l) => l.includes('Official alerts: check IMD') || l.includes('mausam.imd.gov.in')
          );
          const operationalLimitations = rawLimitations.filter(
            (l) => !l.includes('Official alerts: check IMD') && !l.includes('mausam.imd.gov.in')
          );

          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
                animation: 'slideUp 0.25s ease',
              }}
            >
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: m.role === 'user' ? 'var(--primary)' : 'var(--muted)',
                marginBottom: 3,
                paddingLeft: 4,
                paddingRight: 4,
              }}>
                {m.role === 'user' ? 'YOU' : 'WEATHERGPT'}
              </span>

              <div
                className={m.role === 'user' ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-assistant'}
              >
                {/* Visible Loading State: "Thinking..." */}
                {m.isStreaming && m.content === '' ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 2px' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                      Thinking...
                    </span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="typing-dot"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.625, fontSize: '0.875rem' }}>
                    {m.content}
                    {m.isStreaming && (
                      <span style={{
                        display: 'inline-block',
                        width: 2,
                        height: '1em',
                        background: 'var(--primary)',
                        marginLeft: 2,
                        verticalAlign: 'text-bottom',
                        animation: 'shimmer 0.8s ease-in-out infinite',
                      }} />
                    )}
                  </p>
                )}

                {/* Citations & Limitations — sleek collapsible details */}
                {m.role === 'assistant' && !m.isStreaming && Boolean(m.sources?.length || m.knowledge_citations?.length || operationalLimitations.length > 0 || imdNotices.length > 0) && (
                  <details style={{ marginTop: 8, cursor: 'pointer' }}>
                    <summary style={{
                      fontSize: '0.6875rem',
                      color: 'var(--muted)',
                      opacity: 0.75,
                      userSelect: 'none',
                      outline: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.15s ease',
                    }}>
                      <span>ℹ️ Sources & Details</span>
                    </summary>
                    <div style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: '0.72rem',
                      color: 'var(--muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}>
                      {/* Weather Data Sources */}
                      {m.sources && m.sources.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.02em' }}>
                            📡 WEATHER DATA SOURCES:
                          </span>
                          {m.sources.map((s, idx) => (
                            <span key={idx}>
                              {s.uri ? (
                                <a href={s.uri} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                  {s.title}
                                </a>
                              ) : (
                                <span>{s.title}</span>
                              )}
                              {s.attribution && <span style={{ opacity: 0.75 }}> ({s.attribution})</span>}
                              {idx < (m.sources?.length ?? 0) - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Separate Official IMD Alert Note under sources */}
                      {imdNotices.length > 0 && (
                        <div style={{
                          color: 'var(--muted)',
                          fontSize: '0.72rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          lineHeight: 1.4,
                        }}>
                          <span>⚠️ <strong>Official alerts:</strong></span>
                          <a
                            href="https://mausam.imd.gov.in/"
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline' }}
                          >
                            Check IMD (mausam.imd.gov.in)
                          </a>
                        </div>
                      )}

                      {/* Scientific Reference Documents */}
                      {m.knowledge_citations && m.knowledge_citations.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.02em' }}>
                            📚 SCIENTIFIC REFERENCES:
                          </span>
                          {m.knowledge_citations.map((c, idx) => (
                            <span key={idx}>
                              <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{c.title}</strong>
                              {c.summary && <span style={{ opacity: 0.75 }}> — {c.summary}</span>}
                              {idx < (m.knowledge_citations?.length ?? 0) - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Operational Limitations (excluding IMD note) */}
                      {operationalLimitations.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.02em' }}>
                            ⚠️ OPERATIONAL LIMITATIONS:
                          </span>
                          {operationalLimitations.map((lim, idx) => (
                            <span key={idx} style={{ color: 'var(--muted)' }}>
                              {lim}
                              {idx < operationalLimitations.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      {/* ── Sticky Input Bar at Bottom ─────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          alignItems: 'flex-end',
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about weather in ${selectedLocation?.name ?? 'Ahmedabad'} (Enter to send, Shift+Enter for newline)…`}
          disabled={isSubmitting}
          aria-label="Meteorological chat message input"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: '0.875rem',
            lineHeight: 1.4,
            resize: 'none',
            minHeight: '38px',
            maxHeight: '120px',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        <button
          type="submit"
          disabled={isSendDisabled}
          aria-label="Send message"
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 8,
            backgroundColor: isSendDisabled
              ? 'var(--bg)'
              : 'var(--primary)',
            color: isSendDisabled ? 'var(--muted)' : '#0B1220',
            border: isSendDisabled ? '1px solid var(--border)' : 'none',
            fontWeight: 800,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            cursor: isSendDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? (
            <span style={{ fontSize: '0.75rem', animation: 'spin 1s linear infinite' }}>⟳</span>
          ) : (
            '↑'
          )}
        </button>
      </form>
    </div>
  );
};
