# Project Plan: Interactive Map with React, Tailwind, Tailwind-Motion, and Astro

## Step 1: Set Up Project
- [ ] Install Node.js and npm.
- [ ] Create a new Astro project: `npm create astro@latest interactive-map`.
- [ ] Install dependencies:
  - React, Tailwind CSS, Tailwind Motion, Leaflet, Axios: `npm install @astrojs/react react react-dom tailwindcss @tailwindcss/forms @tailwindcss/typography tailwind-motion leaflet axios`.

## Step 2: Configure Astro and Tailwind CSS
- [ ] Add React integration in `astro.config.mjs`.
- [ ] Configure Tailwind in `tailwind.config.js`:
  - Include `@tailwindcss/forms`, `@tailwindcss/typography`.
  - Update `content` paths to include Astro and React files.
- [ ] Create `src/styles/global.css` and include Tailwind base, components, and utilities.

## Step 3: Create React Components
- [ ] Build `Map.jsx`:
  - Use Leaflet for OpenStreetMap integration.
  - Fetch and display event markers from an API.
- [ ] Build `WikipediaOverlay.jsx`:
  - Fetch Wikipedia articles using geolocation and display in a styled list.

## Step 4: Integrate Components in Astro
- [ ] Create an Astro page (e.g., `src/pages/index.astro`) and include React components.
- [ ] Use Tailwind for responsive styling and layout.

## Step 5: Set Up Backend API
- [ ] Create a simple API for events (e.g., Node.js/Express or a static JSON file).
- [ ] Serve event data at `/api/events`.

## Step 6: Add Tailwind Motion
- [ ] Use `tailwind-motion` for animations (e.g., transitions for markers or overlays).
- [ ] Define motion variants and animate entry/exit of elements.

## Step 7: Test and Deploy
- [ ] Test locally: `npm run dev`.
- [ ] Deploy to a hosting platform (e.g., Vercel or Netlify).

## Step 8: Enhance and Maintain
- [ ] Add clustering for map markers (e.g., `leaflet.markercluster`).
- [ ] Implement user geolocation search.
- [ ] Regularly update API data and Wikipedia fetch logic.
