/**
 * Location Selector Module (CLEARSKY_LOCATION)
 * Standalone Vanilla JS Module
 */

(function () {
    'use strict';

    // Prevent re-initialization: check both initialized flag and loading guard
    if (window.CLEARSKY_LOCATION && window.CLEARSKY_LOCATION.__initialized) return;
    if (window.__CLS_LOADING) return;
    window.__CLS_LOADING = true;

    const CLEARSKY_LOCATION = {
        version: '1.0.0',
        __initialized: false,

        Config: {
            apiBaseUrl: '/api/cls',
            storageKeyFavorites: 'cls_favs',
            storageKeyRecent: 'cls_recent',
            containerId: 'cls-location-root'
        },

        State: {
            mode: 'coords',
            favorites: [],
            recent: [],
            current: null,
            isExpanded: false,

            init() {
                this.favorites = JSON.parse(localStorage.getItem(CLEARSKY_LOCATION.Config.storageKeyFavorites) || '[]');
                this.recent = JSON.parse(localStorage.getItem(CLEARSKY_LOCATION.Config.storageKeyRecent) || '[]');
            },

            save() {
                localStorage.setItem(CLEARSKY_LOCATION.Config.storageKeyFavorites, JSON.stringify(this.favorites));
                localStorage.setItem(CLEARSKY_LOCATION.Config.storageKeyRecent, JSON.stringify(this.recent));
            },

            setLocation(loc, source = 'manual') {
                const item = { ...loc, source, time: Date.now() };
                this.current = item;

                if (source === 'manual') {
                    this.recent = [item, ...this.recent.filter(r => r.id !== loc.id)].slice(0, 10);
                }

                this.save();

                // Dispatch event for React bridge
                document.dispatchEvent(new CustomEvent('cls:location:changed', { detail: item }));

                // Close after selection
                this.isExpanded = false;
                CLEARSKY_LOCATION.UI.render();
            }
        },

        UI: {
            root: null,
            container: null,

            init() {
                this.container = document.getElementById(CLEARSKY_LOCATION.Config.containerId);
                if (!this.container) {
                    this.container = document.createElement('div');
                    this.container.id = CLEARSKY_LOCATION.Config.containerId;
                    const dashboard = document.querySelector('header');
                    if (dashboard) dashboard.parentNode.insertBefore(this.container, dashboard.nextSibling);
                    else document.body.prepend(this.container);
                }
                this.render();
            },

            render() {
                const { mode, isExpanded, current } = CLEARSKY_LOCATION.State;
                const currentName = current ? current.name : 'Select Location';

                this.container.innerHTML = `
          <div data-cls-component="location-selector" data-cls-expanded="${isExpanded}">
            <!-- Toggle Header -->
            <button data-cls-element="ui-toggle">
              <span data-cls-element="current-loc-display">📍 ${currentName}</span>
              <span data-cls-element="toggle-icon">${isExpanded ? '▲' : '▼'}</span>
            </button>

            <!-- Collapsible Body -->
            <div data-cls-element="collapsible-body" style="display: ${isExpanded ? 'block' : 'none'}">
              <div data-cls-element="tab-nav">
                <button data-cls-element="tab-button" data-cls-tab="coords" data-cls-state="${mode === 'coords' ? 'active' : ''}">📍 Lat / Lon</button>
                <button data-cls-element="tab-button" data-cls-tab="manual" data-cls-state="${mode === 'manual' ? 'active' : ''}">🔍 City Search</button>
              </div>

              <!-- Coordinates Input -->
              <div data-cls-content="coords" style="display: ${mode === 'coords' ? 'block' : 'none'}">
                <div data-cls-element="coords-form">
                  <div data-cls-element="coords-row">
                    <label data-cls-element="coords-label">Lat</label>
                    <input type="number" data-cls-element="lat-input" step="any" min="-90" max="90" placeholder="37.5665" />
                  </div>
                  <div data-cls-element="coords-row">
                    <label data-cls-element="coords-label">Lon</label>
                    <input type="number" data-cls-element="lon-input" step="any" min="-180" max="180" placeholder="126.9780" />
                  </div>
                  <button data-cls-element="coords-go-btn">Go</button>
                  <div data-cls-element="coords-status" style="margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.4); text-align: center;"></div>
                </div>
              </div>

              <!-- City Search -->
              <div data-cls-content="manual" style="display: ${mode === 'manual' ? 'block' : 'none'}">
                <div data-cls-element="search-container">
                  <input type="text" data-cls-element="search-input" placeholder="Search cities (e.g. Seoul, Tokyo)...">
                  <div data-cls-component="autocomplete" style="display: none"></div>
                </div>

                <div data-cls-element="favorites-section">
                  <div data-cls-element="section-title">⭐ Favorites</div>
                  <div data-cls-element="fav-list"></div>
                </div>

                <div data-cls-element="recent-section">
                  <div data-cls-element="section-title">🕒 Recent Searches</div>
                  <div data-cls-element="recent-list"></div>
                </div>
              </div>
            </div>
          </div>
        `;
                this.bindEvents();
                if (isExpanded) this.update();
            },

            update() {
                const favList = this.container.querySelector('[data-cls-element="fav-list"]');
                const recentList = this.container.querySelector('[data-cls-element="recent-list"]');
                if (!favList || !recentList) return;

                const { favorites, recent } = CLEARSKY_LOCATION.State;

                favList.innerHTML = favorites.length ? favorites.map(f => this.itemHtml(f, true)).join('') : '<div data-cls-element="empty-msg">No favorites yet</div>';
                recentList.innerHTML = recent.length ? recent.map(r => this.itemHtml(r, false)).join('') : '<div data-cls-element="empty-msg">No recent history</div>';
            },

            itemHtml(loc, isFav) {
                return `
          <div data-cls-element="location-item" data-cls-id="${loc.id}">
            <div data-cls-element="location-info">
              <span data-cls-element="location-name">${loc.name}</span>
              <span data-cls-element="location-country">${loc.country}</span>
            </div>
            ${isFav ? `<button data-cls-element="btn-delete" data-cls-id="${loc.id}">✕</button>` : ''}
          </div>
        `;
            },

            bindEvents() {
                this.container.onclick = e => {
                    const t = e.target.closest('[data-cls-element]');
                    if (!t) return;
                    const el = t.dataset.clsElement;

                    if (el === 'ui-toggle' || el === 'current-loc-display' || el === 'toggle-icon') {
                        CLEARSKY_LOCATION.State.isExpanded = !CLEARSKY_LOCATION.State.isExpanded;
                        this.render();
                    } else if (el === 'tab-button') {
                        CLEARSKY_LOCATION.State.mode = t.dataset.clsTab;
                        this.render();
                    } else if (el === 'coords-go-btn') {
                        this.submitCoords();
                    } else if (el === 'location-item') {
                        const id = t.dataset.clsId;
                        const loc = [...CLEARSKY_LOCATION.State.favorites, ...CLEARSKY_LOCATION.State.recent].find(l => l.id === id);
                        if (loc) CLEARSKY_LOCATION.State.setLocation(loc, 'manual');
                    } else if (el === 'btn-delete') {
                        const id = t.dataset.clsId;
                        CLEARSKY_LOCATION.State.favorites = CLEARSKY_LOCATION.State.favorites.filter(f => f.id !== id);
                        CLEARSKY_LOCATION.State.save();
                        this.update();
                    }
                };

                const input = this.container.querySelector('[data-cls-element="search-input"]');
                if (input) {
                    let timer;
                    input.oninput = () => {
                        clearTimeout(timer);
                        const val = input.value.trim();
                        if (val.length < 2) return this.hideResults();
                        timer = setTimeout(() => this.search(val), 300);
                    };
                }
            },

            async search(q) {
                try {
                    const res = await fetch(`${CLEARSKY_LOCATION.Config.apiBaseUrl}/cities/search?q=${q}`);
                    const data = await res.json();
                    this.showResults(data);
                } catch (e) { console.error(e); }
            },

            showResults(list) {
                const ac = this.container.querySelector('[data-cls-component="autocomplete"]');
                if (!ac) return;
                ac.innerHTML = list.map(l => `
          <div data-cls-element="autocomplete-item" data-cls-id="${l.id}">
            <span data-cls-element="city-name">${l.name}</span>
            <span data-cls-element="city-country">${l.country}</span>
          </div>
        `).join('');
                ac.style.display = list.length ? 'block' : 'none';
                ac.onclick = e => {
                    const t = e.target.closest('[data-cls-element="autocomplete-item"]');
                    if (!t) return;
                    const loc = list.find(l => l.id === t.dataset.clsId);
                    if (loc) {
                        CLEARSKY_LOCATION.State.setLocation(loc);
                        ac.style.display = 'none';
                        this.container.querySelector('[data-cls-element="search-input"]').value = '';
                    }
                };
            },

            hideResults() {
                const ac = this.container.querySelector('[data-cls-component="autocomplete"]');
                if (ac) ac.style.display = 'none';
            },

            submitCoords() {
                const latInput = this.container.querySelector('[data-cls-element="lat-input"]');
                const lonInput = this.container.querySelector('[data-cls-element="lon-input"]');
                const status = this.container.querySelector('[data-cls-element="coords-status"]');
                if (!latInput || !lonInput) return;

                const lat = parseFloat(latInput.value);
                const lng = parseFloat(lonInput.value);

                if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    if (status) status.textContent = 'Invalid coordinates (Lat: -90~90, Lon: -180~180)';
                    return;
                }

                CLEARSKY_LOCATION.State.setLocation({
                    id: 'custom-' + lat.toFixed(4) + '-' + lng.toFixed(4),
                    name: lat.toFixed(4) + ', ' + lng.toFixed(4),
                    country: 'Custom Coordinates',
                    lat: lat,
                    lng: lng
                }, 'coords');
            },

        },

        init() {
            if (this.__initialized) return;
            this.State.init();
            this.UI.init();
            this.__initialized = true;
            console.log('[CLS] Initialized');
        }
    };

    window.CLEARSKY_LOCATION = CLEARSKY_LOCATION;
    if (document.readyState === 'complete') {
        CLEARSKY_LOCATION.init();
    } else {
        window.addEventListener('load', () => CLEARSKY_LOCATION.init(), { once: true });
    }
})();
