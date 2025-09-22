/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';


// Define the structure of the weather data for TypeScript
interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
  };
  temperatureCelsius: number;
  temperatureFahrenheit: number;
  feelsLikeCelsius: number;
  feelsLikeFahrenheit: number;
  condition: string;
  humidity: number;
  windSpeedKph: number;
  windSpeedMph: number;
  conditionCode: string; // Standardized code for the weather condition
  error?: string;
}

interface HistoricalDataPoint {
    date: string;
    maxTempC: number;
    minTempC: number;
    maxTempF: number;
    minTempF: number;
    conditionCode: string;
}

interface ForecastDataPoint {
    date: string;
    maxTempC: number;
    minTempC: number;
    maxTempF: number;
    minTempF: number;
    condition: string;
    conditionCode: string;
}


// Define available icon sets
type IconSet = 'emojis' | 'classic';
type Theme = 'light' | 'dark' | 'ocean';

// Define the type for the context passed to child routes
type AppContext = {
  weatherData: WeatherData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  unit: 'C' | 'F';
  setUnit: React.Dispatch<React.SetStateAction<'C' | 'F'>>;
  iconSet: IconSet;
  setIconSet: React.Dispatch<React.SetStateAction<IconSet>>;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  searchHistory: string[];
  handleHistorySearch: (location: string) => void;
  handleRefresh: () => void;
  requestGeolocation: () => void;
};

const iconSets = {
    emojis: {
      'sunny': '☀️',
      'partly-cloudy': '⛅',
      'cloudy': '☁️',
      'rain': '🌧️',
      'snow': '❄️',
      'thunderstorm': '⛈️',
      'fog': '🌫️',
      'windy': '💨',
      'default': '🌡️'
    },
    classic: {
      'sunny': '☼',
      'partly-cloudy': '☁',
      'cloudy': '☁☁',
      'rain': '⛆',
      'snow': '❅',
      'thunderstorm': '☈',
      'fog': '≡',
      'windy': '☴',
      'default': '○'
    }
};

const getIcon = (conditionCode: string, iconSet: IconSet) => {
    const code = conditionCode.toLowerCase() as keyof typeof iconSets[IconSet];
    return iconSets[iconSet][code] || iconSets[iconSet].default;
};

const Home = () => {
  const { weatherData, isLoading, isRefreshing, error, unit, iconSet, handleRefresh, requestGeolocation } = useOutletContext<AppContext>();

  return (
    <div>
      <h1>Welcome to Kalavastha!</h1>
      <p>This is your personal weather companion. Get real-time weather updates, forecasts, and more right here.</p>
      <div className="search-results-container">
        {isLoading && <div className="loader" role="status" aria-label="Loading weather data"></div>}
        {error && (
            <div className="error-message" role="alert">
                <span>{error}</span>
                {error.includes('Location access denied') && (
                    <button onClick={requestGeolocation} className="error-action-btn">
                        Grant Access
                    </button>
                )}
            </div>
        )}
        {weatherData && !isLoading && !error && (
          <div className="weather-card">
            <div className="weather-header">
              <div className="location-info">
                 <h2>{weatherData.location.name}, {weatherData.location.country}</h2>
                 <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="refresh-btn"
                    aria-label="Refresh weather data">
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                 </button>
              </div>
              <div className={`weather-icon icon-${weatherData.conditionCode.toLowerCase()}`}>
                {getIcon(weatherData.conditionCode, iconSet)}
              </div>
            </div>
            <div className="weather-body">
              <p className="temperature">
                {unit === 'C' ? weatherData.temperatureCelsius : weatherData.temperatureFahrenheit}°{unit}
              </p>
              <p className="feels-like">
                Feels like {unit === 'C' ? weatherData.feelsLikeCelsius : weatherData.feelsLikeFahrenheit}°{unit}
              </p>
              <p className="condition">{weatherData.condition}</p>
            </div>
            <div className="weather-details">
              <p><strong>Humidity:</strong> {weatherData.humidity}%</p>
              <p><strong>Wind:</strong> {weatherData.windSpeedKph} kph / {weatherData.windSpeedMph} mph</p>
            </div>
          </div>
        )}
        {!isLoading && !error && !weatherData && (
          <p>Search for a city to see the current weather.</p>
        )}
      </div>
    </div>
  );
};

const About = () => (
    <div>
        <h1>About Kalavastha</h1>
        <p>Kalavastha is a modern weather application built to provide you with accurate and beautiful weather forecasts. Our mission is to deliver weather data in a clean, intuitive, and accessible way, powered by Google's Gemini API.</p>
    </div>
);

const History = () => {
    const { weatherData, unit, iconSet } = useOutletContext<AppContext>();
    const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async (location: string) => {
            if (!location) return;

            setIsLoading(true);
            setError(null);
            setHistoricalData([]);

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: `Get the historical weather for ${location} for the last 7 days. Provide the daily maximum and minimum temperatures and a standardized condition code for each day. Format the date as 'Mon, Jun 10'.`,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                data: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            date: { type: Type.STRING, description: "Formatted date string, e.g., 'Mon, Jun 10'" },
                                            maxTempC: { type: Type.NUMBER },
                                            minTempC: { type: Type.NUMBER },
                                            maxTempF: { type: Type.NUMBER },
                                            minTempF: { type: Type.NUMBER },
                                            conditionCode: { type: Type.STRING, description: 'A single, lowercase, standardized weather condition code. Examples: "sunny", "partly-cloudy", "cloudy", "rain", "snow".' },
                                        },
                                        required: ['date', 'maxTempC', 'minTempC', 'maxTempF', 'minTempF', 'conditionCode'],
                                    },
                                }
                            }
                        },
                    },
                });

                const data: {data: HistoricalDataPoint[]} = JSON.parse(response.text);
                setHistoricalData(data.data);
            } catch (err) {
                console.error("Error fetching historical weather data:", err);
                setError("An unexpected error occurred while fetching historical data.");
            } finally {
                setIsLoading(false);
            }
        };

        if (weatherData?.location) {
            fetchHistory(`${weatherData.location.name}, ${weatherData.location.country}`);
        }
    }, [weatherData]);

    return (
        <div>
            <h1>7-Day Weather Trend</h1>
            {weatherData?.location ? (
                <p>Showing history for: <strong>{weatherData.location.name}, {weatherData.location.country}</strong></p>
            ) : (
                <p>Search for a location to see its 7-day temperature history.</p>
            )}

            <div className="history-container">
                {isLoading && <div className="loader" role="status" aria-label="Loading historical data"></div>}
                {error && <div className="error-message" role="alert">{error}</div>}
                {!isLoading && !error && historicalData.length > 0 && (
                     <div className="history-list-container">
                        {historicalData.map((day, index) => (
                            <div key={index} className="history-day-item" style={{ animationDelay: `${index * 0.05}s` }}>
                                <span className="history-date">{day.date}</span>
                                <span className="history-icon" aria-label={day.conditionCode}>
                                    {getIcon(day.conditionCode, iconSet)}
                                </span>
                                <span className="history-temp">
                                    <strong>{unit === 'C' ? Math.round(day.maxTempC) : Math.round(day.maxTempF)}°</strong>
                                    {' / '}
                                    {unit === 'C' ? Math.round(day.minTempC) : Math.round(day.minTempF)}°
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                 {!isLoading && !error && historicalData.length === 0 && !weatherData?.location && (
                    <p>No data to display. Please search for a city on the Home page.</p>
                )}
            </div>
        </div>
    );
};

const Forecast = () => {
    const { weatherData, unit, iconSet, theme } = useOutletContext<AppContext>();
    const [forecastData, setForecastData] = useState<ForecastDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchForecast = async (location: string) => {
            if (!location) return;

            setIsLoading(true);
            setError(null);
            setForecastData([]);

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: `Get the 5-day weather forecast for ${location}. Provide daily maximum and minimum temperatures, a short condition description, and a standardized condition code for each day. Format the date as 'Tue, 11'.`,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                forecast: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            date: { type: Type.STRING, description: "Formatted date string, e.g., 'Tue, 11'" },
                                            maxTempC: { type: Type.NUMBER },
                                            minTempC: { type: Type.NUMBER },
                                            maxTempF: { type: Type.NUMBER },
                                            minTempF: { type: Type.NUMBER },
                                            condition: { type: Type.STRING },
                                            conditionCode: { type: Type.STRING, description: 'A single, lowercase, standardized weather condition code.' },
                                        },
                                        required: ['date', 'maxTempC', 'minTempC', 'maxTempF', 'minTempF', 'condition', 'conditionCode'],
                                    },
                                }
                            }
                        },
                    },
                });

                const data: {forecast: ForecastDataPoint[]} = JSON.parse(response.text);
                setForecastData(data.forecast);
            } catch (err) {
                console.error("Error fetching forecast data:", err);
                setError("An unexpected error occurred while fetching the forecast.");
            } finally {
                setIsLoading(false);
            }
        };

        if (weatherData?.location) {
            fetchForecast(`${weatherData.location.name}, ${weatherData.location.country}`);
        }
    }, [weatherData]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip">
                    <p className="label">{`${label}`}</p>
                    <p className="condition">{`${getIcon(data.conditionCode, iconSet)} ${data.condition}`}</p>
                    <p className="temp-max">{`High: ${Math.round(payload[0].value)}°`}</p>
                    <p className="temp-min">{`Low: ${Math.round(payload[1].value)}°`}</p>
                </div>
            );
        }
        return null;
    };
    
    const chartLineColor = theme === 'dark' ? '#e0e0e0' : (theme === 'ocean' ? '#e0f2fe' : '#333');

    return (
        <div>
            <h1>5-Day Forecast</h1>
            {weatherData?.location ? (
                <p>Showing forecast for: <strong>{weatherData.location.name}, {weatherData.location.country}</strong></p>
            ) : (
                <p>Search for a location to see its 5-day forecast.</p>
            )}
             <div className="forecast-container">
                {isLoading && <div className="loader" role="status" aria-label="Loading forecast data"></div>}
                {error && <div className="error-message" role="alert">{error}</div>}
                {!isLoading && !error && forecastData.length > 0 && (
                    <ResponsiveContainer width="100%" height={400}>
                         <LineChart
                            data={forecastData}
                            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : (theme === 'ocean' ? '#2c3e5a' : '#ccc')} />
                            <XAxis dataKey="date" stroke={chartLineColor} />
                            <YAxis stroke={chartLineColor} label={{ value: `°${unit}`, angle: -90, position: 'insideLeft', fill: chartLineColor }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey={unit === 'C' ? 'maxTempC' : 'maxTempF'}
                                name="High"
                                stroke="#ff7300"
                                activeDot={{ r: 8 }}
                                strokeWidth={2}
                            />
                            <Line
                                type="monotone"
                                dataKey={unit === 'C' ? 'minTempC' : 'minTempF'}
                                name="Low"
                                stroke="#387908"
                                strokeWidth={2}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
                {!isLoading && !error && forecastData.length === 0 && !weatherData?.location && (
                    <p>No data to display. Please search for a city on the Home page.</p>
                )}
            </div>
        </div>
    );
};

const Settings = () => {
    const { unit, setUnit, iconSet, setIconSet, theme, setTheme, searchHistory, handleHistorySearch } = useOutletContext<AppContext>();

    return (
        <div>
            <h1>Settings</h1>
            <p>Manage your application preferences here.</p>
            <div className="settings-group">
                <h3>Theme</h3>
                <div className="unit-toggle">
                    <button
                        className={theme === 'light' ? 'active' : ''}
                        onClick={() => setTheme('light')}
                        aria-pressed={theme === 'light'}
                    >
                        Light
                    </button>
                    <button
                        className={theme === 'dark' ? 'active' : ''}
                        onClick={() => setTheme('dark')}
                        aria-pressed={theme === 'dark'}
                    >
                        Dark
                    </button>
                    <button
                        className={theme === 'ocean' ? 'active' : ''}
                        onClick={() => setTheme('ocean')}
                        aria-pressed={theme === 'ocean'}
                    >
                        Ocean
                    </button>
                </div>
            </div>
            <div className="settings-group">
                <h3>Temperature Unit</h3>
                <div className="unit-toggle">
                    <button
                        className={unit === 'C' ? 'active' : ''}
                        onClick={() => setUnit('C')}
                        aria-pressed={unit === 'C'}
                    >
                        Celsius (°C)
                    </button>
                    <button
                        className={unit === 'F' ? 'active' : ''}
                        onClick={() => setUnit('F')}
                        aria-pressed={unit === 'F'}
                    >
                        Fahrenheit (°F)
                    </button>
                </div>
            </div>
            <div className="settings-group">
                <h3>Icon Set</h3>
                <div className="unit-toggle">
                    <button
                        className={iconSet === 'emojis' ? 'active' : ''}
                        onClick={() => setIconSet('emojis')}
                        aria-pressed={iconSet === 'emojis'}
                    >
                        Emojis
                    </button>
                    <button
                        className={iconSet === 'classic' ? 'active' : ''}
                        onClick={() => setIconSet('classic')}
                        aria-pressed={iconSet === 'classic'}
                    >
                        Classic
                    </button>
                </div>
            </div>
            <div className="settings-group">
                <h3>Search History</h3>
                {searchHistory.length > 0 ? (
                    <ul className="history-list">
                        {searchHistory.map((location, index) => (
                            <li key={index}>
                                <button onClick={() => handleHistorySearch(location)}>
                                    {location}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No recent searches.</p>
                )}
            </div>
        </div>
    );
};

const Layout = () => {
  const [query, setQuery] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<'C' | 'F'>(
    () => (localStorage.getItem('weather-unit') as 'C' | 'F') || 'C'
  );
  const [iconSet, setIconSet] = useState<IconSet>(
    () => (localStorage.getItem('weather-icon-set') as IconSet) || 'emojis'
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('weather-theme') as Theme) || 'light'
  );
  const [searchHistory, setSearchHistory] = useState<string[]>(
    () => JSON.parse(localStorage.getItem('weather-history') || '[]')
  );
  const navigate = useNavigate();

  const fetchWeather = useCallback(async (locationQuery: string, isRefresh = false) => {
    if (!locationQuery) return;

    if (!isRefresh) {
        setIsLoading(true);
        setWeatherData(null);
        setError(null);
        navigate('/');
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Get the current weather for ${locationQuery}. Provide a standardized condition code and the "feels like" temperature. If the location is not found, the error field should explain that.`,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      location: {
                          type: Type.OBJECT,
                          properties: {
                              name: { type: Type.STRING },
                              region: { type: Type.STRING },
                              country: { type: Type.STRING },
                          },
                          required: ['name', 'region', 'country'],
                      },
                      temperatureCelsius: { type: Type.NUMBER, description: 'Temperature in Celsius' },
                      temperatureFahrenheit: { type: Type.NUMBER, description: 'Temperature in Fahrenheit' },
                      feelsLikeCelsius: { type: Type.NUMBER, description: 'The "feels like" temperature in Celsius' },
                      feelsLikeFahrenheit: { type: Type.NUMBER, description: 'The "feels like" temperature in Fahrenheit' },
                      condition: { type: Type.STRING, description: 'e.g., Sunny, Partly cloudy' },
                      humidity: { type: Type.NUMBER, description: 'Humidity in percentage' },
                      windSpeedKph: { type: Type.NUMBER, description: 'Wind speed in kilometers per hour' },
                      windSpeedMph: { type: Type.NUMBER, description: 'Wind speed in miles per hour' },
                      conditionCode: { type: Type.STRING, description: 'A single, lowercase, standardized weather condition code. Examples: "sunny", "partly-cloudy", "cloudy", "rain", "snow", "thunderstorm", "fog", "windy".' },
                      error: { type: Type.STRING, description: 'Error message if location is not found' },
                  },
              },
          },
      });

      const data: WeatherData = JSON.parse(response.text);

      if (data.error) {
        if (!isRefresh) {
            setError(data.error);
        } else {
            console.warn("Auto-refresh failed:", data.error);
        }
      } else {
        setError(null);
        setWeatherData(data);
        if (!isRefresh) {
            const isCoords = /^-?[\d.]+, ?-?[\d.]+$/.test(locationQuery.trim());
            const historyEntry = isCoords ? `${data.location.name}, ${data.location.country}` : locationQuery;
            const newHistory = [
                historyEntry,
                ...searchHistory.filter(item => item.toLowerCase() !== historyEntry.toLowerCase())
            ].slice(0, 5);
            setSearchHistory(newHistory);
        }
      }
    } catch (err) {
      console.error("Error fetching weather data:", err);
      if (!isRefresh) {
        setError("An unexpected error occurred while fetching weather data. Please try again.");
      }
    } finally {
      if (!isRefresh) {
        setIsLoading(false);
        setQuery('');
      }
    }
  }, [navigate, searchHistory]);
  
  const requestGeolocation = useCallback(() => {
    if (navigator.geolocation) {
        // Clear previous errors and show loader while asking for permission
        setError(null);
        if (!weatherData) setIsLoading(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeather(`${latitude},${longitude}`);
            },
            (err) => {
                setIsLoading(false); // Stop loader on error
                console.warn(`Geolocation error: ${err.message}`);
                if (err.code === err.PERMISSION_DENIED) {
                    setError("Location access denied. Please allow location access to see weather for your current location, or search for a city manually.");
                } else {
                    setError("Could not get your location automatically. Please search for a city manually.");
                }
            }
        );
    } else {
        setError("Geolocation is not supported by your browser. Please search for a city manually.");
    }
  }, [fetchWeather, weatherData]);

  useEffect(() => {
    // Only request location on initial load if no data exists
    if (!weatherData && searchHistory.length === 0) {
        requestGeolocation();
    }
  // We only want this to run once on mount, so we disable the linter warning.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('weather-unit', unit);
  }, [unit]);

  useEffect(() => {
    localStorage.setItem('weather-icon-set', iconSet);
  }, [iconSet]);
  
  useEffect(() => {
    localStorage.setItem('weather-theme', theme);
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('weather-history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Effect for automatic data refresh
  useEffect(() => {
    if (!weatherData?.location) {
        return; // Don't start the timer if there's no location
    }

    const refreshInterval = 15 * 60 * 1000; // 15 minutes

    const intervalId = setInterval(() => {
        const locationQuery = `${weatherData.location.name}, ${weatherData.location.country}`;
        fetchWeather(locationQuery, true); // Call with the refresh flag
    }, refreshInterval);

    // Cleanup function to clear the interval when the component unmounts
    // or when the location changes.
    return () => {
        clearInterval(intervalId);
    };
  }, [weatherData, fetchWeather]);


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWeather(query.trim());
  };

  const handleHistorySearch = (location: string) => {
    fetchWeather(location);
  };

  const handleRefresh = useCallback(async () => {
    if (!weatherData?.location) return;

    setIsRefreshing(true);
    const locationQuery = `${weatherData.location.name}, ${weatherData.location.country}`;
    await fetchWeather(locationQuery, true);
    setIsRefreshing(false);
  }, [weatherData, fetchWeather]);

  return (
    <>
      <header>
        <nav>
          <ul>
            <li>
              <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/forecast" className={({ isActive }) => (isActive ? 'active' : '')}>
                Forecast
              </NavLink>
            </li>
             <li>
              <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
                History
              </NavLink>
            </li>
            <li>
              <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>
                About
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
                Settings
              </NavLink>
            </li>
          </ul>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a city..."
              aria-label="Search for a city"
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </nav>
      </header>
      <main>
        <Outlet context={{ weatherData, isLoading, isRefreshing, error, unit, setUnit, iconSet, setIconSet, theme, setTheme, searchHistory, handleHistorySearch, handleRefresh, requestGeolocation }} />
      </main>
    </>
  );
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
