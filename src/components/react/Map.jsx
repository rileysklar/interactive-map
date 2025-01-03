import React, { useEffect, useRef, useState } from 'react';
import './LeafletMap.css';

export const Map = () => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef({});
  const radiusCircleRef = useRef(null);

  const addArticleMarkers = (articles) => {
    if (!mapRef.current || !window.L) return;
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Clear existing radius circle
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
    }

    // Add new markers
    articles.forEach(article => {
      const marker = window.L.marker([article.lat, article.lon])
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-medium mb-2">${article.title}</h3>
            ${article.thumbnail ? 
              `<img src="${article.thumbnail}" alt="${article.title}" class="w-full h-32 object-cover rounded mb-2"/>` 
              : ''}
            <p class="text-sm mb-2">${article.extract?.substring(0, 100)}...</p>
            <div class="flex justify-between items-center text-xs text-muted-foreground">
              <span>📍 ${Math.round(article.dist)}m away</span>
              <a href="https://en.wikipedia.org/?curid=${article.pageid}" 
                 target="_blank" 
                 class="text-blue-500 hover:text-blue-700">
                Read More →
              </a>
            </div>
          </div>
        `)
        .addTo(mapRef.current);
      
      marker.on('click', () => {
        window.dispatchEvent(new CustomEvent('markerClicked', { 
          detail: { pageid: article.pageid }
        }));
      });
      
      markersRef.current[article.pageid] = marker;
    });

    // If we have articles, draw radius circle around the search center
    if (articles.length > 0) {
      const center = mapRef.current.getCenter();
      const radius = articles[0].searchRadius || 10000; // Use the radius from the API or default
      radiusCircleRef.current = window.L.circle([center.lat, center.lng], {
        radius: radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(mapRef.current);
    }
  };

  const highlightMarker = (pageid) => {
    const marker = markersRef.current[pageid];
    if (marker) {
      marker.openPopup();
      mapRef.current.panTo(marker.getLatLng());
    }
  };

  // Function to update map center
  const setMapCenter = (lat, lon, zoom = 13) => {
    if (mapRef.current) {
      console.log('Setting map center to:', lat, lon);
      mapRef.current.setView([lat, lon], zoom);
      
      // Update radius circle position
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setLatLng([lat, lon]);
      }
    }
  };

  useEffect(() => {
    const initMap = async () => {
      if (typeof window !== 'undefined') {
        const L = (await import('leaflet')).default;
        window.L = L;
        
        if (mapContainerRef.current && !mapRef.current) {
          const map = L.map(mapContainerRef.current);
          mapRef.current = map;
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(map);

          // Set default view
          map.setView([37.7749, -122.4194], 13);

          // Expose functions to window
          window.setMapCenter = setMapCenter;
          window.addArticleMarkers = addArticleMarkers;
          window.highlightMarker = highlightMarker;
        }
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainerRef} className="absolute inset-0" />
    </div>
  );
}; 