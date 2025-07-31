import { useState, useEffect } from 'react';
import { loadGoogleMapsAPI } from '../utils/googleMapsLoader';

export const useStreetView = (apiKey) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key is required');
      setLoading(false);
      return;
    }

    loadGoogleMapsAPI(apiKey)
      .then(() => {
        setIsLoaded(true);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoaded(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey]);

  return { isLoaded, error, loading };
};
