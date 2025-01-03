import React, { useEffect, useRef, useState } from 'react';
import './LeafletMap.css';

export const Map = () => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const initMap = async () => {
      if (typeof window !== 'undefined') {
        const L = (await import('leaflet')).default;
        
        if (mapContainerRef.current && !mapRef.current) {
          // Initialize map with OpenStreetMap
          mapRef.current = L.map(mapContainerRef.current).setView([51.505, -0.09], 13);

          // Add OpenStreetMap tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(mapRef.current);

          // Add controls
          L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
          L.control.scale({ imperial: false }).addTo(mapRef.current);
        }
      }
    };

    initMap();

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainerRef} className="absolute inset-0" />
    </div>
  );
}; 