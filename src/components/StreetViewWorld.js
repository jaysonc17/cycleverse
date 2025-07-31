import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Camera, Play, Pause } from 'lucide-react';

const StreetViewWorld = ({ speed, isRiding, onLocationChange }) => {
  const streetViewRef = useRef(null);
  const [streetView, setStreetView] = useState(null);
  const [currentPosition, setCurrentPosition] = useState({ lat: 37.7749, lng: -122.4194 });
  const [heading, setHeading] = useState(0);
  const [route, setRoute] = useState([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeProgress, setRouteProgress] = useState(0);

  const popularRoutes = {
    'golden-gate': {
      name: 'Golden Gate Bridge',
      start: { lat: 37.8199, lng: -122.4783 },
      end: { lat: 37.8085, lng: -122.4750 },
      description: 'Iconic San Francisco landmark ride'
    },
    'central-park': {
      name: 'Central Park Loop',
      start: { lat: 40.7829, lng: -73.9654 },
      end: { lat: 40.7829, lng: -73.9654 },
      description: 'NYC premier cycling destination'
    },
    'london-thames': {
      name: 'Thames Path London',
      start: { lat: 51.5074, lng: -0.1278 },
      end: { lat: 51.5033, lng: -0.1195 },
      description: 'Historic London waterfront'
    },
    'amsterdam-canals': {
      name: 'Amsterdam Canals',
      start: { lat: 52.3676, lng: 4.9041 },
      end: { lat: 52.3702, lng: 4.8952 },
      description: 'Dutch cycling paradise'
    }
  };

  useEffect(() => {
    if (!window.google) {
      setError('Google Maps API not loaded. Please check your API key.');
      return;
    }

    const sv = new window.google.maps.StreetViewPanorama(streetViewRef.current, {
      position: currentPosition,
      pov: { heading: heading, pitch: 0 },
      zoom: 1,
      addressControl: false,
      fullscreenControl: false,
      showRoadLabels: true,
      clickToGo: false,
      scrollwheel: false,
      linksControl: true,
      panControl: true,
      enableCloseButton: false
    });

    setStreetView(sv);

    sv.addListener('position_changed', () => {
      const pos = sv.getPosition();
      if (pos) {
        setCurrentPosition({ lat: pos.lat(), lng: pos.lng() });
        onLocationChange && onLocationChange({ lat: pos.lat(), lng: pos.lng() });
      }
    });

    sv.addListener('pov_changed', () => {
      const pov = sv.getPov();
      setHeading(pov.heading);
    });
  }, [currentPosition.lat, currentPosition.lng, heading, onLocationChange]);

  const generateRoute = useCallback(async (startPoint, endPoint) => {
    if (!window.google) return;
    setIsLoading(true);
    setError(null);

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const request = {
        origin: startPoint,
        destination: endPoint,
        travelMode: window.google.maps.TravelMode.BICYCLING,
        avoidHighways: true,
        avoidTolls: true
      };

      directionsService.route(request, (result, status) => {
        if (status === 'OK') {
          const routePoints = [];
          const legs = result.routes[0].legs;
          
          legs.forEach(leg => {
            leg.steps.forEach(step => {
              const path = step.path || step.lat_lngs;
              if (path) {
                path.forEach(point => {
                  routePoints.push({
                    lat: typeof point.lat === 'function' ? point.lat() : point.lat,
                    lng: typeof point.lng === 'function' ? point.lng() : point.lng
                  });
                });
              }
            });
          });

          setRoute(routePoints);
          setRouteIndex(0);
          setRouteProgress(0);
          
          if (routePoints.length > 0 && streetView) {
            streetView.setPosition(routePoints[0]);
          }
        } else {
          setError(`Route generation failed: ${status}`);
        }
        setIsLoading(false);
      });
    } catch (err) {
      setError(`Error generating route: ${err.message}`);
      setIsLoading(false);
    }
  }, [streetView]);

  useEffect(() => {
    if (!isRiding || route.length === 0 || routeIndex >= route.length - 1) return;

    const interval = setInterval(() => {
      const pointsPerSecond = Math.max(1, Math.floor(speed / 10));
      
      setRouteIndex(prevIndex => {
        const newIndex = Math.min(prevIndex + pointsPerSecond, route.length - 1);
        
        if (streetView && route[newIndex]) {
          streetView.setPosition(route[newIndex]);
          
          if (newIndex < route.length - 1) {
            const current = route[newIndex];
            const next = route[newIndex + 1];
            const heading = calculateHeading(current, next);
            streetView.setPov({ heading, pitch: 0, zoom: 1 });
          }
        }

        const progress = (newIndex / (route.length - 1)) * 100;
        setRouteProgress(progress);
        return newIndex;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRiding, route, routeIndex, speed, streetView]);

  const calculateHeading = (from, to) => {
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    return (heading + 360) % 360;
  };

  const selectRoute = (routeKey) => {
    const selectedRoute = popularRoutes[routeKey];
    if (selectedRoute) {
      generateRoute(selectedRoute.start, selectedRoute.end);
    }
  };

  const handleCustomLocation = async (location) => {
    if (!window.google) return;
    setIsLoading(true);
    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ address: location }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const position = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        };
        
        if (streetView) {
          streetView.setPosition(position);
          setCurrentPosition(position);
        }
      } else {
        setError(`Location not found: ${location}`);
      }
      setIsLoading(false);
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 bg-black">
        <div ref={streetViewRef} className="w-full h-full" />
        
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <div>Loading Street View...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-900 bg-opacity-90 border border-red-500 rounded p-3 text-white">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-white">×</button>
            </div>
          </div>
        )}

        {route.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 rounded p-3">
            <div className="flex items-center justify-between text-white text-sm mb-2">
              <span>Route Progress</span>
              <span>{routeProgress.toFixed(1)}% Complete</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${routeProgress}%` }}></div>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-4 bg-black bg-opacity-70 rounded p-3 text-white">
          <div className="flex items-center space-x-2 text-sm">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span>{currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-300 mt-1">
            <Navigation className="w-3 h-3" />
            <span>Heading: {heading.toFixed(0)}°</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-400" />
            <span>Street View Routes</span>
          </h3>
          <div className="flex items-center space-x-2">
            {isRiding ? (
              <div className="flex items-center space-x-2 text-green-400">
                <Play className="w-4 h-4" />
                <span>Riding</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-500">
                <Pause className="w-4 h-4" />
                <span>Paused</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(popularRoutes).map(([key, route]) => (
            <button
              key={key}
              onClick={() => selectRoute(key)}
              disabled={isLoading}
              className="p-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-left transition-colors"
            >
              <div className="text-white font-medium">{route.name}</div>
              <div className="text-gray-300 text-sm">{route.description}</div>
            </button>
          ))}
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Enter city, address, or landmark..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCustomLocation(e.target.value);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.target.previousElementSibling;
              if (input.value) {
                handleCustomLocation(input.value);
                input.value = '';
              }
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-white"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
};

export default StreetViewWorld;
