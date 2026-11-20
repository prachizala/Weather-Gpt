"""Weather-adaptive ambient audio soundscape synthesis frequency generator."""


class SoundscapeSynthesizer:
    """Calculates acoustic pink-noise and frequency filter parameters matching live meteorology."""

    WEATHER_PROFILES = {
        "RAIN": {"base_frequency_hz": 440, "filter_q": 1.2, "gain_db": -6.0},
        "THUNDER": {"base_frequency_hz": 80, "filter_q": 3.5, "gain_db": -2.0},
        "WIND": {"base_frequency_hz": 220, "filter_q": 0.8, "gain_db": -8.0},
        "CLEAR": {"base_frequency_hz": 528, "filter_q": 0.5, "gain_db": -12.0},
    }

    @classmethod
    def get_audio_params(cls, condition: str) -> dict:
        """Returns synthesis filter parameters for audio engine."""
        cond_upper = condition.strip().upper()
        return cls.WEATHER_PROFILES.get(cond_upper, cls.WEATHER_PROFILES["CLEAR"])
