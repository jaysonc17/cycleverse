import React, { useState } from 'react';
import StreetViewWorld from './StreetViewWorld';
import { useStreetView } from '../hooks/useStreetView';
import { Settings, Key, Globe } from 'lucide-react';

const StreetViewIntegration = ({ speed, isRiding, currentData }) => {
  const [apiKey, setApiKey] = useState(process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey);
  const [currentLocation, setCurrentLocation] = useState(null);
  
  const { isLoaded, error, loading } = useStreetView(apiKey);

  const handleLocationChange = (location) => {
    setCurrentLocation(location);
  };

  if (!apiKey || showApiKeyInput) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-white">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <Globe className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Google Street View Integration</h2>
              <p className="text-gray-400">Enter your Google Maps API key to enable real-world cycling routes</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Google Maps API Key</label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIza..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setShowApiKeyInput(false)}
                    disabled={!apiKey}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium"
                  >
                    Load
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <h3 className="font-medium flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span>How to get API Key:</span>
                </h3>
                <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Console</a></li>
                  <li>Create a new project or select existing one</li>
                  <li>Enable "Maps JavaScript API" and "Street View Static API"</li>
                  <li>Create credentials → API key</li>
                  <li>Restrict the key to your domain for security</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div>Loading Google Maps...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-white">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-red-400 text-6xl">⚠️</div>
            <h2 className="text-xl font-bold">Street View Error</h2>
            <p className="text-gray-400">{error}</p>
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
            >
              Check API Key
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {currentLocation && (
        <div className="bg-gray-800 p-2 text-white text-sm">
          <div className="flex items-center justify-between">
            <span>Real-world location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}</span>
            <button onClick={() => setShowApiKeyInput(true)} className="text-gray-400 hover:text-white">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <StreetViewWorld
        speed={speed}
        isRiding={isRiding}
        onLocationChange={handleLocationChange}
        currentData={currentData}
      />
    </div>
  );
};

export default StreetViewIntegration;
