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
                // 이 기기에 저장해 둔 마지막 위치를 복원 — 새로고침해도 다시 입력 안 하게
                try {
                    const saved = JSON.parse(localStorage.getItem('cls_current') || 'null');
                    if (saved && typeof saved.lat === 'number' && typeof saved.lng === 'number') this.current = saved;
                } catch { /* storage 차단 환경 */ }
                // 첫 방문(위치를 한 번도 설정한 적 없음) → 위치 입력 탭을 자동으로 펼쳐 안내
                let located = null;
                try { located = localStorage.getItem('cls_located'); } catch { /* storage 차단 환경 */ }
                if (!located && !this.current) {
                    // 한국어 사용자는 주소, 그 외는 도시 검색이 편하다
                    const isKo = (navigator.language || '').toLowerCase().startsWith('ko');
                    this.mode = isKo ? 'address' : 'manual';
                    this.isExpanded = true;
                    this.firstRun = true;
                }
            },

            save() {
                localStorage.setItem(CLEARSKY_LOCATION.Config.storageKeyFavorites, JSON.stringify(this.favorites));
                localStorage.setItem(CLEARSKY_LOCATION.Config.storageKeyRecent, JSON.stringify(this.recent));
            },

            setLocation(loc, source = 'manual') {
                const item = { ...loc, source, time: Date.now() };
                this.current = item;
                this.firstRun = false;
                // 위치를 설정하면 첫 방문 안내를 끄고, 고른 위치를 기기에 저장(새로고침해도 유지)
                try {
                    localStorage.setItem('cls_located', '1');
                    localStorage.setItem('cls_current', JSON.stringify({ id: loc.id, name: loc.name, country: loc.country, lat: loc.lat, lng: loc.lng }));
                } catch { /* storage 차단 환경 */ }

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
                const isKo = (navigator.language || '').toLowerCase().startsWith('ko');
                const currentName = current ? current.name : (isKo ? '내 위치 설정하기' : 'Set your location');
                const notSetYet = !current ? (isKo ? ' 아직 위치를 설정하지 않아 지금은 기본 지역 예보가 보입니다.' : ' No location set yet — showing the default area for now.') : '';

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
                <button data-cls-element="tab-button" data-cls-tab="address" data-cls-state="${mode === 'address' ? 'active' : ''}">🏠 주소</button>
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
                <div data-cls-element="city-intro">관측할 위치를 찾아보세요 · Search your city to see tonight's observing conditions.${notSetYet}</div>
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

              <!-- Address Search (주소 입력 → 좌표, GPS 미사용 · 사용자 제공 위치) -->
              <div data-cls-content="address" style="display: ${mode === 'address' ? 'block' : 'none'}">
                <div data-cls-element="addr-intro">
                  <div data-cls-element="addr-intro-title">📍 어디서 하늘을 보시나요?</div>
                  <div data-cls-element="addr-intro-sub">주소를 입력하면 그 위치의 오늘 밤 관측 조건을 알려 드려요.${notSetYet}</div>
                </div>
                <div data-cls-element="search-container">
                  <input type="text" data-cls-element="addr-input" placeholder="주소 입력 (예: 서울 종로구 세종대로 1)">
                  <div data-cls-component="autocomplete" style="display: none"></div>
                </div>
                <div data-cls-element="addr-privacy">GPS를 쓰지 않아요 · 입력한 위치는 이 기기에만 저장됩니다</div>
              </div>
            </div>
          </div>
        `;
                this.bindEvents();
                if (isExpanded) this.update();

                // 첫 방문이면 입력창에 커서를 둬 바로 타이핑하게 (데스크톱만 — 모바일은 키보드가 튀어 역효과)
                if (CLEARSKY_LOCATION.State.firstRun && isExpanded &&
                    window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                    const sel = mode === 'address' ? '[data-cls-element="addr-input"]' : '[data-cls-element="search-input"]';
                    const inp = this.container.querySelector(sel);
                    if (inp) inp.focus();
                }
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

                const addrInput = this.container.querySelector('[data-cls-element="addr-input"]');
                if (addrInput) {
                    let atimer;
                    addrInput.oninput = () => {
                        clearTimeout(atimer);
                        const val = addrInput.value.trim();
                        if (val.length < 2) return this.hideAddrResults();
                        // 주소는 500ms 디바운스(Nominatim 정책 배려 + 불필요한 호출 방지)
                        atimer = setTimeout(() => this.searchAddress(val), 500);
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

            // ── 주소 지오코딩 (백엔드 /api/geocode 프록시: Kakao 키 있으면 Kakao, 없으면 Nominatim) ──
            async searchAddress(q) {
                try {
                    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
                    const data = await res.json();
                    this.showAddrResults(Array.isArray(data) ? data : []);
                } catch (e) { console.error(e); }
            },

            showAddrResults(list) {
                const panel = this.container.querySelector('[data-cls-content="address"]');
                const ac = panel && panel.querySelector('[data-cls-component="autocomplete"]');
                if (!ac) return;
                ac.innerHTML = list.map((l, i) => `
          <div data-cls-element="autocomplete-item" data-cls-idx="${i}">
            <span data-cls-element="city-name">${l.name}</span>
          </div>
        `).join('');
                ac.style.display = list.length ? 'block' : 'none';
                ac.onclick = e => {
                    const t = e.target.closest('[data-cls-element="autocomplete-item"]');
                    if (!t) return;
                    const loc = list[parseInt(t.dataset.clsIdx, 10)];
                    if (loc) {
                        CLEARSKY_LOCATION.State.setLocation({
                            id: 'addr-' + loc.lat.toFixed(4) + '-' + loc.lng.toFixed(4),
                            name: loc.name,
                            country: '입력 주소',
                            lat: loc.lat,
                            lng: loc.lng,
                        }, 'coords');
                        ac.style.display = 'none';
                        const ai = panel.querySelector('[data-cls-element="addr-input"]');
                        if (ai) ai.value = '';
                    }
                };
            },

            hideAddrResults() {
                const panel = this.container.querySelector('[data-cls-content="address"]');
                const ac = panel && panel.querySelector('[data-cls-component="autocomplete"]');
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
