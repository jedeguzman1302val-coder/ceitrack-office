 document.addEventListener('DOMContentLoaded', () => {
            // --- Adviser header info (copied from adviserdashboard.js) ---
            const currentUserJSON = sessionStorage.getItem('currentUser');
            const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;

            function displayHeaderInfo() {
                // Some pages use #adviser-name while others use .user-name — handle both
                const adviserNameEl = document.getElementById('adviser-name') || document.querySelector('.user-name');
                const adviserAvatarEl = document.querySelector('.user-profile img');
                const metaEl = document.querySelector('.user-meta');

                if (!currentUser) return;

                const adviserName = currentUser.name || 'Adviser';
                const adviserDept = currentUser.department || '';
                const adviserSection = currentUser.section || '';

                if (adviserNameEl) adviserNameEl.textContent = adviserName;
                if (adviserAvatarEl) adviserAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adviserName)}&background=4361ee&color=fff`;
                if (metaEl) metaEl.textContent = (adviserDept && adviserSection) ? `${adviserDept} • ${adviserSection}` : (adviserDept || adviserSection || '');
            }

            displayHeaderInfo();

            // --- Sidebar Toggle Logic ---
            const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
            const sidebar = document.querySelector('.sidebar');
            
            // Sidebar stays closed by default; user opens it with the toggle

            if (sidebarToggleBtn && sidebar) {
                sidebarToggleBtn.addEventListener('click', () => {
                    sidebar.classList.toggle('active');
                });
            }

            // --- Map and Student List Logic ---
            const studentItems = document.querySelectorAll('.student-item');
            const mapMessage = document.getElementById('map-message');
            const mapPin = document.getElementById('map-pin');

            // Firebase setup (client) - reuse same config as other pages
            const firebaseConfig = {
                apiKey: "AIzaSyCeTfbcz9-lqT0JTMO8JVTWV-luBhT8kO0",
                authDomain: "project-6675709483481122019.firebaseapp.com",
                databaseURL: "https://project-6675709483481122019-default-rtdb.firebaseio.com",
                projectId: "project-6675709483481122019",
                storageBucket: "project-6675709483481122019.appspot.com",
                messagingSenderId: "305985446601",
                appId: "1:305985446601:web:914f344ff38ac5b177e318"
            };

            // Initialize Firebase if not already
            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                try { firebase.initializeApp(firebaseConfig); } catch (e) { console.warn('Firebase init warning', e); }
            }
            const db = (typeof firebase !== 'undefined') ? firebase.firestore() : null;

            // MapTiler setup
            const apiKey = "1GJ94oYVxT0kOUf6u8hC"; // provided by user
            let map = null;
            let mapMarker = null;

            function initMap() {
                try {
                    // Load map if container exists
                    const mapContainer = document.getElementById('map');
                    if (!mapContainer) return;

                    // Include MapTiler via CDN if maplibre isn't already loaded
                    if (typeof maplibregl === 'undefined') {
                        const script = document.createElement('script');
                        script.src = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js';
                        script.onload = () => createMapInstance(mapContainer);
                        document.head.appendChild(script);
                        const css = document.createElement('link');
                        css.rel = 'stylesheet';
                        css.href = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css';
                        document.head.appendChild(css);
                    } else {
                        createMapInstance(mapContainer);
                    }
                } catch (e) {
                    console.error('initMap error', e);
                }
            }

            function createMapInstance(container) {
                try {
                    map = new maplibregl.Map({
                        container: container,
                        style: `https://api.maptiler.com/maps/streets/style.json?key=${apiKey}`,
                        center: [121.0437, 14.6760], // Metro Manila center (lng, lat)
                        zoom: 11
                    });

                    // Add zoom controls
                    map.addControl(new maplibregl.NavigationControl());

                    // Create a marker element (we'll reuse the existing #map-pin for visuals)
                    mapMarker = new maplibregl.Marker({
                        element: mapPin || undefined,
                        anchor: 'bottom'
                    });
                    // Add sources/layers for route (line) and company radius (circle)
                    map.on('load', () => {
                        if (!map.getSource('route')) {
                            map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                        }
                        if (!map.getLayer('route-line')) {
                            map.addLayer({
                                id: 'route-line',
                                type: 'line',
                                source: 'route',
                                layout: { 'line-join': 'round', 'line-cap': 'round' },
                                paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.7 }
                            });
                        }
                        // Add company radius circle layer
                        if (!map.getSource('company-radius')) {
                            map.addSource('company-radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                        }
                        if (!map.getLayer('company-radius-fill')) {
                            map.addLayer({
                                id: 'company-radius-fill',
                                type: 'fill',
                                source: 'company-radius',
                                paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.15 }
                            });
                        }
                        if (!map.getLayer('company-radius-outline')) {
                            map.addLayer({
                                id: 'company-radius-outline',
                                type: 'line',
                                source: 'company-radius',
                                paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-opacity': 0.6 }
                            });
                        }
                    });
                } catch (e) {
                    console.error('createMapInstance error', e);
                }
            }

            // Initialize the map
            initMap();

            // Attach handlers only when elements exist and guard missing buttons
            studentItems.forEach(item => {
                const trackButton = item.querySelector('.track-btn');

                if (!trackButton) {
                    // If there's no track button, clicking the item shows a pending placement message
                    item.addEventListener('click', () => {
                        const studentName = item.dataset.name || 'Student';
                        if (mapMessage) mapMessage.textContent = `${studentName} is pending placement.`;
                        if (mapPin) mapPin.style.display = 'none';
                        studentItems.forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                    });
                    return;
                }

                trackButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    studentItems.forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    const studentName = item.dataset.name;
                    const lat = parseFloat(item.dataset.lat);
                    const lng = parseFloat(item.dataset.lng);
                    if (mapMessage) mapMessage.textContent = `Currently tracking ${studentName}...`;
                    if (!isNaN(lat) && !isNaN(lng) && mapPin) {
                        updatePinPosition(lat, lng);
                        mapPin.style.display = 'block';
                    } else if (mapPin) {
                        mapPin.style.display = 'none';
                    }

                    // Write an initial tracking document into Firestore (blank/defaults)
                    try {
                        const currentUserJSON = sessionStorage.getItem('currentUser');
                        const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;
                        const dept = currentUser?.department || '';
                        const section = currentUser?.section || '';
                        const studentNumber = item.dataset['studentId'] || item.dataset['studentId'] || item.getAttribute('data-student-id') || '';

                        if (db && dept && section && studentNumber) {
                            const trackRef = db.collection('students').doc(dept).collection(section).doc(studentNumber).collection('track').doc('current');
                            // Create document with default fields (studentTrack false, empty locations)
                            trackRef.set({
                                studentTrack: false,
                                currentlocation: '',
                                htelocation: ''
                            }, { merge: true }).then(() => {
                                console.log('Initialized tracking doc for', studentNumber);
                            }).catch(e => console.error('Failed to initialize tracking doc', e));
                        } else {
                            console.warn('Firestore not available or missing dept/section/studentNumber - skipping track init', { dept, section, studentNumber });
                        }
                    } catch (e) {
                        console.error('Error while initializing track document', e);
                    }
                });
            });

            function updatePinPosition(lat, lng) {
                const mapBounds = {
                    top: 14.75, // North
                    bottom: 14.40, // South
                    left: 120.95, // West
                    right: 121.10 // East
                };
                const percentY = ((mapBounds.top - lat) / (mapBounds.top - mapBounds.bottom)) * 100;
                const percentX = ((lng - mapBounds.left) / (mapBounds.right - mapBounds.left)) * 100;
                const top = Math.max(0, Math.min(100, percentY));
                const left = Math.max(0, Math.min(100, percentX));
                if (mapPin) {
                    mapPin.style.top = `${top}%`;
                    mapPin.style.left = `${left}%`;
                }
                // If map is available, move the marker and optionally center the map
                if (map && typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                    try {
                        if (mapMarker) {
                            mapMarker.setLngLat([lng, lat]);
                            // If marker element wasn't attached as part of maplibre Marker, attach now
                            if (!mapMarker._map && mapPin) mapMarker.addTo(map);
                        } else if (mapPin) {
                            // fallback: center map and rely on css pin overlay
                            map.setCenter([lng, lat]);
                        }
                        // Smoothly fly to location
                        map.flyTo({ center: [lng, lat], zoom: 14, speed: 0.8 });
                    } catch (e) {
                        console.error('Error updating map marker', e);
                    }
                }
            }

            // Helpers: parse currentlocation "lat,lon" string and return [lon,lat]
            function parseLatLngString(locStr) {
                if (!locStr || typeof locStr !== 'string') return null;
                // Remove whitespace and split by comma (or semicolon)
                const parts = locStr.replace(/\s+/g, '').split(/[;,]/);
                if (parts.length < 2) return null;
                // Strip non-numeric characters except .+-
                const a = parseFloat(parts[0].replace(/[^0-9.+-]/g, ''));
                const b = parseFloat(parts[1].replace(/[^0-9.+-]/g, ''));
                if (isNaN(a) || isNaN(b)) return null;

                // Determine whether string is (lat,lng) or (lng,lat) by value ranges
                // Latitude is in [-90, 90], Longitude is in [-180, 180]
                function isLat(x) { return x >= -90 && x <= 90; }
                function isLng(x) { return x >= -180 && x <= 180; }

                // If a looks like lat and b looks like lng -> interpret as (lat,lng)
                if (isLat(a) && isLng(b) && !(isLng(a) && isLat(b))) {
                    return [b, a]; // [lng, lat]
                }
                // If a looks like lng and b looks like lat -> interpret as (lng,lat)
                if (isLng(a) && isLat(b) && !(isLat(a) && isLng(b))) {
                    return [a, b];
                }

                // If both plausible, use heuristic: prefer lat in typical PH range (4..21)
                if (isLat(a) && isLat(b)) {
                    // If one falls inside Philippines approximate latitude, choose accordingly
                    const phLatRange = (x => x >= 4 && x <= 21);
                    if (phLatRange(a) && !phLatRange(b)) return [b, a];
                    if (phLatRange(b) && !phLatRange(a)) return [a, b];
                }

                // If ambiguous, default to [lng, lat] assuming input is lng,lat
                console.warn('Ambiguous lat/lng order, assuming [lng,lat] for', locStr);
                return [a, b];
            }

            // Geocode an address using MapTiler Search API (forward geocoding)
            // Improvements:
            // - Simple in-memory cache to avoid repeated requests for same address
            // - Bias results to Philippines using country/countrycode and proximity parameters
            // - Fallback: if first result is outside PH try to pick a PH feature from results
            const _geocodeCache = new Map();
            async function geocodeAddress(address) {
                if (!address) return null;
                // If address already looks like lat,lng parse it directly
                const maybe = parseLatLngString(address);
                if (maybe) return maybe;

                const key = address.trim().toLowerCase();
                if (_geocodeCache.has(key)) return _geocodeCache.get(key);

                try {
                    // Use MapTiler Search with filters. MapTiler supports `country` and `proximity` params.
                    // We'll request a few results and then prefer one inside the Philippines (country code: "PH").
                    const encoded = encodeURIComponent(address);
                    // bias toward Metro Manila with proximity (lng,lat)
                    const proximity = encodeURIComponent('121.0437,14.6760');
                    // First try: restrict to Philippines (country=PH) to avoid wrong-country matches
                    const url1 = `https://api.maptiler.com/search?q=${encoded}&key=${apiKey}&limit=5&proximity=${proximity}&country=PH`;
                    let res = await fetch(url1);
                    let data = null;
                    if (res && res.ok) data = await res.json();

                    // If the country-restricted search returned nothing, try a second attempt by appending ", Philippines"
                    if ((!data || !data.features || data.features.length === 0) && !/philipp/i.test(address)) {
                        const encoded2 = encodeURIComponent(address + ', Philippines');
                        const url2 = `https://api.maptiler.com/search?q=${encoded2}&key=${apiKey}&limit=5&proximity=${proximity}`;
                        try {
                            const res2 = await fetch(url2);
                            if (res2 && res2.ok) data = await res2.json();
                        } catch (e) { /* ignore */ }
                    }
                    if (!data || !data.features || data.features.length === 0) return null;

                    // Helper: pick a feature that has PH in its properties (country_code or context)
                    function isPhilippinesFeature(feat) {
                        try {
                            // Some providers use properties.country or properties.country_code
                            const props = feat.properties || {};
                            const countryCode = (props.country_code || props.country || '').toString().toUpperCase();
                            if (countryCode === 'PH' || countryCode === 'PHL' || countryCode === 'PHL') return true;
                            // Also inspect the feature's context array (MapTiler/Geocoding may include country context)
                            if (Array.isArray(feat.context)) {
                                for (const c of feat.context) {
                                    const id = (c.id || '').toString().toLowerCase();
                                    if (id.startsWith('country') && (c.short_code || c.id || '').toString().toLowerCase().includes('ph')) return true;
                                }
                            }
                        } catch (e) { /* ignore */ }
                        return false;
                    }

                    // Prefer a PH feature from the returned list
                    let chosen = null;
                    for (const f of data.features) {
                        if (isPhilippinesFeature(f)) { chosen = f; break; }
                    }
                    // If none explicitly PH, prefer first result but only if it's plausibly in Philippines bounding box
                    if (!chosen) chosen = data.features[0];

                    // Verify that chosen coordinate is inside Philippines bounding box; if not, try to find any PH-feature
                    const coords = chosen.geometry && chosen.geometry.coordinates;
                    if (coords && coords.length === 2) {
                        const [lng, lat] = coords;
                        // Philippines rough bbox (approx): lon 116..127, lat 4..21
                        if (lng >= 116 && lng <= 127 && lat >= 4 && lat <= 21) {
                            _geocodeCache.set(key, coords);
                            return coords;
                        }
                        // otherwise try to find any feature inside bbox
                        for (const f of data.features) {
                            const c = f.geometry && f.geometry.coordinates;
                            if (c && c.length === 2) {
                                const [lng2, lat2] = c;
                                if (lng2 >= 116 && lng2 <= 127 && lat2 >= 4 && lat2 <= 21) {
                                    _geocodeCache.set(key, c);
                                    return c;
                                }
                            }
                        }
                    }

                    // If no PH coordinates found, return null (don't fall back to other-country coords)
                    return null;

                } catch (e) {
                    console.warn('Geocode error', e);
                }
                return null;
            }

            // Manage markers per student (in-memory map)
            const studentMarkers = new Map();
            const companyMarkers = new Map();

            function createOrUpdateMarker(mapObj, id, coords, type) {
                // type: 'student' | 'company'
                if (!coords || coords.length < 2) return null;
                const key = `${id}:${type}`;
                const existing = (type === 'student' ? studentMarkers.get(id) : companyMarkers.get(id));
                if (existing) {
                    try { existing.setLngLat(coords); } catch (e) { /* ignore */ }
                    return existing;
                }

                const el = document.createElement('div');
                el.className = `marker marker-${type}`;
                if (type === 'student') el.title = 'Student location'; else el.title = 'Company location';

                // Use inline SVG for crisp, styleable icons
                                if (type === 'student') {
                                        // Person / user silhouette SVG (student)
                                        el.innerHTML = `
                                                <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                                    <g fill="none" fill-rule="evenodd">
                                                        <circle cx="12" cy="12" r="12" fill="#4361EE" />
                                                        <path d="M12 13c2.761 0 5 2.239 5 5v.5a.5.5 0 0 1-.5.5H7.5a.5.5 0 0 1-.5-.5V18c0-2.761 2.239-5 5-5z" fill="#fff"/>
                                                        <circle cx="12" cy="8" r="2.5" fill="#fff" />
                                                    </g>
                                                </svg>`;
                                } else {
                                        // Building / pin SVG (company)
                                        el.innerHTML = `
                                                <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                                    <g fill="none" fill-rule="evenodd">
                                                        <circle cx="12" cy="12" r="12" fill="#F59E0B" />
                                                        <path d="M7 11h2v6H7v-6zm4-4h2v10h-2V7zm4 2h2v8h-2v-8z" fill="#fff"/>
                                                    </g>
                                                </svg>`;
                                }

                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(coords).addTo(map);
                if (type === 'student') studentMarkers.set(id, marker); else companyMarkers.set(id, marker);
                return marker;
            }

            function removeMarkersForStudent(id) {
                const s = studentMarkers.get(id);
                if (s) { try { s.remove(); } catch (e) {} studentMarkers.delete(id); }
                const c = companyMarkers.get(id);
                if (c) { try { c.remove(); } catch (e) {} companyMarkers.delete(id); }
            }

            // Helper: Calculate distance between two points in meters (Haversine formula)
            function calculateDistance(coord1, coord2) {
                const [lng1, lat1] = coord1;
                const [lng2, lat2] = coord2;
                const R = 6371e3; // Earth radius in meters
                const φ1 = lat1 * Math.PI / 180;
                const φ2 = lat2 * Math.PI / 180;
                const Δφ = (lat2 - lat1) * Math.PI / 180;
                const Δλ = (lng2 - lng1) * Math.PI / 180;
                const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                          Math.cos(φ1) * Math.cos(φ2) *
                          Math.sin(Δλ/2) * Math.sin(Δλ/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c; // Distance in meters
            }

            // Helper: Create a circle polygon (for company radius visualization)
            function createCircle(center, radiusInMeters, points = 64) {
                const coords = [];
                const distanceX = radiusInMeters / (111320 * Math.cos(center[1] * Math.PI / 180));
                const distanceY = radiusInMeters / 110574;
                for (let i = 0; i <= points; i++) {
                    const theta = (i / points) * (2 * Math.PI);
                    const x = distanceX * Math.cos(theta);
                    const y = distanceY * Math.sin(theta);
                    coords.push([center[0] + x, center[1] + y]);
                }
                return {
                    type: 'Feature',
                    geometry: { type: 'Polygon', coordinates: [coords] }
                };
            }

            // Draw company radius circle
            function drawCompanyRadius(companyCoords, radiusMeters = 200) {
                if (!map || !map.getSource) return;
                try {
                    if (!map.getSource('company-radius')) {
                        map.addSource('company-radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    }
                    const source = map.getSource('company-radius');
                    if (!source) return;
                    
                    if (!companyCoords) {
                        source.setData({ type: 'FeatureCollection', features: [] });
                        return;
                    }
                    
                    const circle = createCircle(companyCoords, radiusMeters);
                    source.setData({ type: 'FeatureCollection', features: [circle] });
                } catch (e) {
                    console.warn('Error drawing company radius', e);
                }
            }

            // Draw a route following roads between two points.
            // Uses OSRM public routing API; falls back to a straight line if routing fails.
            async function drawRouteBetween(aCoords, bCoords, studentInsideRadius = false) {
                if (!map || !map.getSource) return;
                // Ensure route source and layer exist
                try {
                    if (!map.getSource('route')) {
                        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                    }
                    if (!map.getLayer('route-line')) {
                        map.addLayer({
                            id: 'route-line',
                            type: 'line',
                            source: 'route',
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.7 }
                        });
                    }
                } catch (e) {
                    console.warn('Error ensuring route source/layer', e);
                }

                const source = map.getSource('route');
                if (!source) return;
                
                // If student is inside radius, don't draw route
                if (studentInsideRadius) {
                    source.setData({ type: 'FeatureCollection', features: [] });
                    return;
                }
                
                if (!aCoords || !bCoords) {
                    source.setData({ type: 'FeatureCollection', features: [] });
                    return;
                }

                console.debug('Requesting route between', aCoords, bCoords);
                // aCoords and bCoords are [lng, lat]
                try {
                    const [alng, alat] = aCoords;
                    const [blng, blat] = bCoords;
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${alng},${alat};${blng},${blat}?overview=full&geometries=geojson`;
                    const res = await fetch(osrmUrl);
                    if (!res) {
                        console.warn('No response from router');
                    } else if (!res.ok) {
                        console.warn('Router responded with non-ok status', res.status);
                    } else {
                        const json = await res.json();
                        console.debug('Router response', json && json.routes && json.routes.length ? 'routes:' + json.routes.length : 'no routes');
                        if (json && json.routes && json.routes.length) {
                            const geom = json.routes[0].geometry; // GeoJSON LineString
                            const feature = { type: 'Feature', geometry: geom };
                            source.setData({ type: 'FeatureCollection', features: [feature] });
                            if (mapMessage) mapMessage.textContent = '';
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('Routing request failed', e);
                }

                // Fallback: draw a straight line between the two points and notify
                try {
                    const feature = {
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: [aCoords, bCoords] }
                    };
                    source.setData({ type: 'FeatureCollection', features: [feature] });
                    if (mapMessage) mapMessage.textContent = 'Showing straight-line fallback route.';
                } catch (e) {
                    console.warn('Failed to set fallback route', e);
                    if (mapMessage) mapMessage.textContent = 'Route unavailable.';
                }
            }

            // --- Fetch and render students dynamically ---
            const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '3000')) ? 'http://localhost:3000' : '';

            async function fetchStudents() {
                try {
                    // adviser info from sessionStorage (if available)
                    const currentUserJSON = sessionStorage.getItem('currentUser');
                    const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;
                    const dept = currentUser?.department || '';
                    const section = currentUser?.section || '';

                    const url = dept && section ? `${API_BASE}/api/students/${dept}/${section}` : `${API_BASE}/api/students`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('Failed to fetch students');
                    const students = await res.json();
                    renderStudentList(students || []);
                } catch (err) {
                    console.error('fetchStudents error', err);
                    const list = document.querySelector('.student-list');
                    if (list) list.innerHTML = '<li style="padding:12px;color:#6b7280;">Failed to load students.</li>';
                }
            }

            function renderStudentList(students) {
                const list = document.querySelector('.student-list');
                if (!list) return;
                list.innerHTML = '';
                if (!students || students.length === 0) {
                    list.innerHTML = '<li style="padding:12px;color:#6b7280;">No students found.</li>';
                    return;
                }

                // Helper to detect real company presence (same logic as below)
                function isRealString(val) {
                    if (typeof val !== 'string') return false;
                    const v = val.trim().toLowerCase();
                    if (!v) return false;
                    const bad = ['null', 'undefined', 'n/a', 'na', '-', 'none'];
                    return !bad.includes(v);
                }

                function studentHasCompany(s) {
                    const companyFields = [s.company, s.placement, s.employer, s.companyName, s.company_name, s.employerName];
                    return companyFields.some(isRealString);
                }

                // Sort: students with company first, then alphabetically by name
                try {
                    students.sort((a, b) => {
                        const aHas = studentHasCompany(a) ? 1 : 0;
                        const bHas = studentHasCompany(b) ? 1 : 0;
                        if (aHas !== bHas) return bHas - aHas;
                        const aName = (a.name || (a.firstName ? `${a.firstName} ${a.lastName}` : '')).toLowerCase();
                        const bName = (b.name || (b.firstName ? `${b.firstName} ${b.lastName}` : '')).toLowerCase();
                        return aName.localeCompare(bName);
                    });
                } catch (e) {
                    console.error('Error sorting students by company presence', e);
                }

                students.forEach(s => {
                    const name = s.name || (s.firstName ? `${s.firstName} ${s.lastName}` : 'Unnamed');
                    const lat = s.lat || s.latitude || '';
                    const lng = s.lng || s.longitude || '';
                    const studentNumber = s.idNumber || s.studentNumber || s.id || '';

                    const li = document.createElement('li');
                    li.className = 'student-item';
                    if (lat && lng) {
                        li.setAttribute('data-lat', lat);
                        li.setAttribute('data-lng', lng);
                    }
                    li.setAttribute('data-name', name);

                    if (studentNumber) li.setAttribute('data-student-id', studentNumber);

                    // Robust company presence detection: check common fields and ignore placeholder values
                    function isRealString(val) {
                        if (typeof val !== 'string') return false;
                        const v = val.trim().toLowerCase();
                        if (!v) return false;
                        const bad = ['null', 'undefined', 'n/a', 'na', '-', 'none'];
                        return !bad.includes(v);
                    }

                    const companyFields = [s.company, s.placement, s.employer, s.companyName, s.company_name, s.employerName];
                    const companyPresent = companyFields.some(isRealString);

                    // Show Track button only when a company/placement exists. If company missing, show Pending Placement even if coords present.
                    const hasCompany = !!companyPresent;

                    li.innerHTML = `
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff" alt="Student Avatar">
                        <div class="student-info">
                            <span class="student-name">${name}</span>
                            <span class="student-meta">${studentNumber}</span>
                        </div>
                        ${hasCompany ? `<button class="track-btn"><i class="fas fa-map-pin"></i> Track</button>` : `<span class="no-placement" style="color:#6b7280;font-size:13px;padding:6px 10px;border-radius:6px;">Pending Placement</span>`}
                    `;

                    list.appendChild(li);
                });

                // attach handlers only to track buttons; items without track button show a pending message when clicked
                const items = list.querySelectorAll('.student-item');
                items.forEach(item => {
                    const btn = item.querySelector('.track-btn');
                    if (btn) {
                            // Helper: set button visual state based on tracking flag
                            function setButtonState(button, tracking) {
                                if (tracking) {
                                    button.classList.add('untracking');
                                    button.innerHTML = '<i class="fas fa-ban"></i> Untrack';
                                } else {
                                    button.classList.remove('untracking');
                                    button.innerHTML = '<i class="fas fa-map-pin"></i> Track';
                                }
                            }

                            // If Firestore available, listen for changes to student's track/current doc
                            let unsubscribe = null;
                            try {
                                const currentUserJSON = sessionStorage.getItem('currentUser');
                                const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;
                                const dept = currentUser?.department || '';
                                const section = currentUser?.section || '';
                                const studentNumber = item.dataset['studentId'] || item.getAttribute('data-student-id') || '';

                                if (db && dept && section && studentNumber) {
                                    const trackRef = db.collection('students').doc(dept).collection(section).doc(studentNumber).collection('track').doc('current');
                                    unsubscribe = trackRef.onSnapshot(async doc => {
                                        const data = doc.exists ? doc.data() : null;
                                        const tracking = !!(data && data.studentTrack);
                                        setButtonState(btn, tracking);

                                        // Parse currentlocation lat,lng string
                                        const currentLoc = data?.currentlocation || '';
                                        const hteLoc = data?.htelocation || '';

                                        // Remove markers/route/radius when doc missing or emptied
                                        if (!data) {
                                            removeMarkersForStudent(studentNumber);
                                            drawRouteBetween(null, null);
                                            drawCompanyRadius(null);
                                            items.forEach(el => el.classList.remove('active'));
                                            if (mapMessage) mapMessage.textContent = 'Select a student to view location.';
                                            return;
                                        }

                                        // Student coords from currentlocation string
                                        const studentCoords = parseLatLngString(currentLoc);

                                        // Company coords: geocode hteLoc if it's an address string
                                        let companyCoords = null;
                                        if (hteLoc && typeof hteLoc === 'string') {
                                            // If hteLoc looks like coords "lat,lng" parse directly, else geocode
                                            const maybeCoords = parseLatLngString(hteLoc);
                                            if (maybeCoords) companyCoords = maybeCoords;
                                            else companyCoords = await geocodeAddress(hteLoc);
                                        }

                                        // Create/update markers, but only if coords are plausibly within the Philippines
                                        function isInPhilippines([lng, lat]) {
                                            return (lng >= 116 && lng <= 127 && lat >= 4 && lat <= 21);
                                        }

                                        // Student marker
                                        if (studentCoords) {
                                            if (isInPhilippines(studentCoords)) {
                                                createOrUpdateMarker(map, studentNumber, studentCoords, 'student');
                                            } else {
                                                console.debug('Student coords outside PH, skipping marker', studentNumber, studentCoords, 'raw:', currentLoc);
                                                if (mapMessage) mapMessage.textContent = `${item.dataset.name} location outside Philippines - marker hidden.`;
                                                const m = studentMarkers.get(studentNumber);
                                                if (m) { try { m.remove(); } catch (e) {} studentMarkers.delete(studentNumber); }
                                            }
                                        }
                                        else {
                                            const m = studentMarkers.get(studentNumber);
                                            if (m) { try { m.remove(); } catch (e) {} studentMarkers.delete(studentNumber); }
                                        }

                                        // Company marker
                                        if (companyCoords) {
                                            if (isInPhilippines(companyCoords)) {
                                                createOrUpdateMarker(map, studentNumber, companyCoords, 'company');
                                            } else {
                                                console.debug('Company coords outside PH, skipping marker', studentNumber, companyCoords, 'raw hte:', hteLoc);
                                                if (mapMessage) mapMessage.textContent = `Company address not located in the Philippines for ${item.dataset.name}.`;
                                                const m = companyMarkers.get(studentNumber);
                                                if (m) { try { m.remove(); } catch (e) {} companyMarkers.delete(studentNumber); }
                                            }
                                        }
                                        else {
                                            const m = companyMarkers.get(studentNumber);
                                            if (m) { try { m.remove(); } catch (e) {} companyMarkers.delete(studentNumber); }
                                        }

                                        // Draw company radius and route when both present
                                        if (studentCoords && companyCoords) {
                                            // Draw company radius circle (200 meters)
                                            const radiusMeters = 200;
                                            drawCompanyRadius(companyCoords, radiusMeters);
                                            
                                            // Check if student is inside company radius
                                            const distance = calculateDistance(studentCoords, companyCoords);
                                            const isInside = distance <= radiusMeters;
                                            
                                            // Draw route only if student is outside radius
                                            drawRouteBetween(studentCoords, companyCoords, isInside);
                                            
                                            // Update message based on location
                                            if (mapMessage) {
                                                if (isInside) {
                                                    mapMessage.textContent = `${item.dataset.name} is inside the company (${Math.round(distance)}m away)`;
                                                } else {
                                                    mapMessage.textContent = `${item.dataset.name} is ${Math.round(distance)}m from company`;
                                                }
                                            }
                                            
                                            // Optionally fit bounds to show both points
                                            try {
                                                const bounds = new maplibregl.LngLatBounds();
                                                bounds.extend(studentCoords);
                                                bounds.extend(companyCoords);
                                                map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
                                            } catch (e) { /* ignore */ }
                                        } else {
                                            drawRouteBetween(null, null);
                                            drawCompanyRadius(null);
                                        }

                                        // If this student is currently being tracked (set by the tracking source),
                                        // ensure the UI selects them and centers the map so the state persists across reloads.
                                        if (tracking) {
                                            try {
                                                // clear other active items and mark this one active
                                                items.forEach(el => el.classList.remove('active'));
                                                item.classList.add('active');
                                                if (mapMessage) mapMessage.textContent = `Currently tracking ${item.dataset.name}...`;
                                                // Prefer centering on student coords, fallback to company coords
                                                if (studentCoords) {
                                                    if (map && map.flyTo) map.flyTo({ center: studentCoords, zoom: 14, speed: 0.8 });
                                                } else if (companyCoords) {
                                                    if (map && map.flyTo) map.flyTo({ center: companyCoords, zoom: 14, speed: 0.8 });
                                                }
                                            } catch (e) {
                                                console.warn('Error auto-selecting tracked student', e);
                                            }
                                        }

                                    }, err => {
                                        console.warn('Track onSnapshot error', err);
                                    });
                                }
                            } catch (e) {
                                console.warn('Error attaching realtime listener', e);
                            }

                            btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            items.forEach(el => el.classList.remove('active'));
                            item.classList.add('active');
                            const name = item.dataset.name;
                            const lat = parseFloat(item.dataset.lat);
                            const lng = parseFloat(item.dataset.lng);
                            if (mapMessage) mapMessage.textContent = `Currently tracking ${name}...`;
                            if (!isNaN(lat) && !isNaN(lng)) {
                                updatePinPosition(lat, lng);
                                mapPin.style.display = 'block';
                            } else {
                                mapPin.style.display = 'none';
                            }
                                // Attempt to toggle tracking document in Firestore for this student (dynamic list handler)
                            try {
                                const currentUserJSON = sessionStorage.getItem('currentUser');
                                const currentUser = currentUserJSON ? JSON.parse(currentUserJSON) : null;
                                const dept = currentUser?.department || '';
                                const section = currentUser?.section || '';
                                const studentNumber = item.dataset['studentId'] || item.getAttribute('data-student-id') || '';
                                            if (db && dept && section && studentNumber) {
                                                const trackCollectionRef = db.collection('students').doc(dept).collection(section).doc(studentNumber).collection('track');
                                                const currentDocRef = trackCollectionRef.doc('current');
                                                // If button is currently untracking (red), treat click as Untrack -> delete track collection docs
                                                if (btn.classList.contains('untracking')) {
                                                    // Delete all docs in the track collection (batch deletes)
                                                    // Note: client-side deletion of collections should be batched and careful for large sets.
                                                    (async function deleteTrackCollection() {
                                                        try {
                                                            let deleted = 0;
                                                            const pageSize = 50;
                                                            while (true) {
                                                                const snapshot = await trackCollectionRef.limit(pageSize).get();
                                                                if (snapshot.empty) break;
                                                                const batch = db.batch();
                                                                snapshot.docs.forEach(d => batch.delete(d.ref));
                                                                await batch.commit();
                                                                deleted += snapshot.docs.length;
                                                                if (snapshot.docs.length < pageSize) break;
                                                            }
                                                            console.log(`Deleted ${deleted} docs from track collection for ${studentNumber}`);
                                                            
                                                            // Remove all markers, routes, and radius circle
                                                            removeMarkersForStudent(studentNumber);
                                                            drawRouteBetween(null, null);
                                                            drawCompanyRadius(null);
                                                            
                                                            // Clear active state
                                                            items.forEach(el => el.classList.remove('active'));
                                                            
                                                            if (mapMessage) mapMessage.textContent = `${name} untracked.`;
                                                        } catch (err) {
                                                            console.error('Failed to delete track collection', err);
                                                            if (mapMessage) mapMessage.textContent = `Failed to untrack ${name}.`;
                                                        }
                                                    })();
                                                } else {
                                                    // Track button clicked: ensure the tracking document exists but do not set studentTrack
                                                    // Ensure doc exists and explicitly set studentTrack to false (do not set true here)
                                                    currentDocRef.set({ studentTrack: false, currentlocation: '', htelocation: '' }, { merge: true }).then(() => {
                                                        console.log('Ensured tracking doc exists for', studentNumber);
                                                        if (mapMessage) mapMessage.textContent = `Tracking doc ensured for ${name}.`;
                                                    }).catch(e => {
                                                        console.error('Failed to ensure tracking doc', e);
                                                        if (mapMessage) mapMessage.textContent = `Failed to ensure tracking for ${name}.`;
                                                    });
                                                }
                                            } else {
                                                console.warn('Firestore not available or missing dept/section/studentNumber - skipping track init', { dept, section, studentNumber });
                                                if (mapMessage) mapMessage.textContent = `Tracking not initialized (missing info).`;
                                            }
                            } catch (e) {
                                console.error('Error while initializing track document', e);
                                if (mapMessage) mapMessage.textContent = `Error initializing tracking for ${name}.`;
                            }
                        });
                            // cleanup when item removed from DOM (best-effort)
                            item._unsub = unsubscribe;
                    } else {
                        // clicking the item shows pending placement message
                        item.addEventListener('click', () => {
                            const name = item.dataset.name;
                            mapMessage.textContent = `${name} is pending placement.`;
                            mapPin.style.display = 'none';
                            items.forEach(el => el.classList.remove('active'));
                            item.classList.add('active');
                        });
                    }
                });
            }

            // Logout functionality
            const logoutLinks = document.querySelectorAll('a[href="#"]');
            logoutLinks.forEach(link => {
                if (link.textContent.trim().toLowerCase().includes('logout')) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        sessionStorage.clear();
                        window.location.href = '../officelogin/officelogin.html';
                    });
                }
            });

            // Fetch students on load
            fetchStudents();
        });