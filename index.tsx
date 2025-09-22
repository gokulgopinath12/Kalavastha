/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink, Outlet, useOutletContext, useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// Define the structure of the weather data for TypeScript
interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
  };
  temperatureCelsius: number;
  temperatureFahrenheit: number;
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
}

// Define available icon sets
type IconSet = 'emojis' | 'classic';

// Define the type for the context passed to child routes
type AppContext = {
  weatherData: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  unit: 'C' | 'F';
  setUnit: React.Dispatch<React.SetStateAction<'C' | 'F'>>;
  iconSet: IconSet;
  setIconSet: React.Dispatch<React.SetStateAction<IconSet>>;
  searchHistory: string[];
  handleHistorySearch: (location: string) => void;
};

const Home = () => {
  const { weatherData, isLoading, error, unit, iconSet } = useOutletContext<AppContext>();

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

  const getIcon = (conditionCode: string) => {
    const code = conditionCode.toLowerCase() as keyof typeof iconSets[IconSet];
    return iconSets[iconSet][code] || iconSets[iconSet].default;
  };

  return (
    <div>
      <h1>Welcome to Kalavastha!</h1>
      <p>This is your personal weather companion. Get real-time weather updates, forecasts, and more right here.</p>
      <div className="search-results-container">
        {isLoading && <div className="loader" role="status" aria-label="Loading weather data"></div>}
        {error && <div className="error-message" role="alert">{error}</div>}
        {weatherData && !isLoading && !error && (
          <div className="weather-card">
            <div className="weather-header">
              <h2>{weatherData.location.name}, {weatherData.location.country}</h2>
              <div className={`weather-icon icon-${weatherData.conditionCode.toLowerCase()}`}>
                {getIcon(weatherData.conditionCode)}
              </div>
            </div>
            <div className="weather-body">
              <p className="temperature">
                {unit === 'C' ? weatherData.temperatureCelsius : weatherData.temperatureFahrenheit}°{unit}
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
    const { weatherData, unit } = useOutletContext<AppContext>();
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
                    contents: `Get the historical weather for ${location} for the last 7 days. Provide the daily maximum and minimum temperatures. Format the date as 'Mon, Jun 10'.`,
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
                                        },
                                        required: ['date', 'maxTempC', 'minTempC', 'maxTempF', 'minTempF'],
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

    const maxTempKey = unit === 'C' ? 'maxTempC' : 'maxTempF';
    const minTempKey = unit === 'C' ? 'minTempC' : 'minTempF';
    
    return (
        <div>
            <h1>7-Day Temperature Trend</h1>
            {weatherData?.location ? (
                <p>Showing history for: <strong>{weatherData.location.name}, {weatherData.location.country}</strong></p>
            ) : (
                <p>Search for a location to see its 7-day temperature history.</p>
            )}

            <div className="history-container">
                {isLoading && <div className="loader" role="status" aria-label="Loading historical data"></div>}
                {error && <div className="error-message" role="alert">{error}</div>}
                {!isLoading && !error && historicalData.length > 0 && (
                     <div className="chart-container">
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis label={{ value: `Temperature (°${unit})`, angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey={maxTempKey} name={`Max Temp (°${unit})`} stroke="#ff6b6b" activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey={minTempKey} name={`Min Temp (°${unit})`} stroke="#4dabf7" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
                 {!isLoading && !error && historicalData.length === 0 && !weatherData?.location && (
                    <p>No data to display. Please search for a city on the Home page.</p>
                )}
            </div>
        </div>
    );
};


const Settings = () => {
    const { unit, setUnit, iconSet, setIconSet, searchHistory, handleHistorySearch } = useOutletContext<AppContext>();

    return (
        <div>
            <h1>Settings</h1>
            <p>Manage your application preferences here.</p>
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
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<'C' | 'F'>(
    () => (localStorage.getItem('weather-unit') as 'C' | 'F') || 'C'
  );
  const [iconSet, setIconSet] = useState<IconSet>(
    () => (localStorage.getItem('weather-icon-set') as IconSet) || 'emojis'
  );
  const [searchHistory, setSearchHistory] = useState<string[]>(
    () => JSON.parse(localStorage.getItem('weather-history') || '[]')
  );
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('weather-unit', unit);
  }, [unit]);

  useEffect(() => {
    localStorage.setItem('weather-icon-set', iconSet);
  }, [iconSet]);

  useEffect(() => {
    localStorage.setItem('weather-history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  const fetchWeather = async (locationQuery: string) => {
    if (!locationQuery) return;

    setIsLoading(true);
    setWeatherData(null);
    setError(null);
    navigate('/'); // Navigate to home on new search

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Get the current weather for ${locationQuery}. Provide a standardized condition code. If the location is not found, the error field should explain that.`,
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
          setError(data.error);
      } else {
          setWeatherData(data);
          const newHistory = [
            locationQuery,
            ...searchHistory.filter(item => item.toLowerCase() !== locationQuery.toLowerCase())
          ].slice(0, 5);
          setSearchHistory(newHistory);
      }
    } catch (err) {
      console.error("Error fetching weather data:", err);
      setError("An unexpected error occurred while fetching weather data. Please try again.");
    } finally {
      setIsLoading(false);
      setQuery('');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWeather(query.trim());
  };

  const handleHistorySearch = (location: string) => {
    fetchWeather(location);
  };

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
        <Outlet context={{ weatherData, isLoading, error, unit, setUnit, iconSet, setIconSet, searchHistory, handleHistorySearch }} />
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