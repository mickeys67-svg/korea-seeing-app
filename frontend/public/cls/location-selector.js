/**
 * Location Selector Module (CLEARSKY_LOCATION)
 * Standalone Vanilla JS Module
 */

(function () {
    'use strict';

    if (window.CLEARSKY_LOCATION && window.CLEARSKY_LOCATION.__initialized) return;

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
            mode: 'gps',
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
                <button data-cls-element="tab-button" data-cls-tab="gps" data-cls-state="${mode === 'gps' ? 'active' : ''}">📍 GPS Mode</button>
                <button data-cls-element="tab-button" data-cls-tab="manual" data-cls-state="${mode === 'manual' ? 'active' : ''}">🔍 City Search</button>
              </div>
              
              <div data-cls-content="gps" style="display: ${mode === 'gps' ? 'block' : 'none'}">
                <button data-cls-element="refresh-btn">🔄 Detect Current Location</button>
                <div data-cls-element="gps-status" style="margin-top: 10px; font-size: 13px; color: rgba(255,255,255,0.5); text-align: center;"></div>
              </div>
              
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
                    } else if (el === 'refresh-btn') {
                        this.detectGps();
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

            detectGps() {
                if (!navigator.geolocation) return this.setGpsStatus('GPS not supported');

                const btn = this.container.querySelector('[data-cls-element="refresh-btn"]');
                if (btn) btn.disabled = true;
                this.setGpsStatus('Detecting...');

                navigator.geolocation.getCurrentPosition(pos => {
                    CLEARSKY_LOCATION.State.setLocation({
                        id: 'gps-current',
                        name: 'Current Location',
                        country: 'Detected via GPS',
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    }, 'gps');
                    if (btn) btn.disabled = false;
                    this.setGpsStatus('Location updated!');
                    setTimeout(() => this.setGpsStatus(''), 3000);
                }, err => {
                    if (btn) btn.disabled = false;
                    this.setGpsStatus('GPS Error: ' + err.message);
                });
            },

            setGpsStatus(msg) {
                const s = this.container.querySelector('[data-cls-element="gps-status"]');
                if (s) s.textContent = msg;
            }
        },

        init() {
            this.State.init();
            this.UI.init();
            this.__initialized = true;
            console.log('[CLS] Initialized');
        }
    };

    window.CLEARSKY_LOCATION = CLEARSKY_LOCATION;
    if (document.readyState === 'complete') CLEARSKY_LOCATION.init();
    else window.addEventListener('load', () => CLEARSKY_LOCATION.init());
})();
