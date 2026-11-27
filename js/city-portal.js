(function () {
  const PREVIEW_LIMIT = 8;
  let currentLang = localStorage.getItem('sonar_lang') || 'mr';
  let cityData = null;
  let eventsList = [];
  let galleryAlbums = [];
  let activeYear = '';
  let activeAlbumId = '';
  let photosExpanded = false;
  let lightboxPhotos = [];
  let lightboxIdx = 0;

  const uiStrings = {
    mr: {
      back_main: 'मुख्य पोर्टल (सोनार समाज इंदूर)',
      nav_events: 'कार्यक्रम (Events)',
      nav_gallery: 'फोटो गॅलरी (Gallery)',
      nav_indore: 'मुख्य इंदूर पोर्टल ↗',
      hero_badge: 'सोनार समाज अधिकृत शाखा पोर्टल',
      cta_events: 'कार्यक्रम पहा (Events)',
      cta_gallery: 'फोटो गॅलरी (Gallery)',
      events_pill: 'कार्यक्रम • Events',
      events_heading: 'आगामी व संपन्न कार्यक्रम',
      events_sub: 'या शहर शाखेचे सर्व सामाजिक, धार्मिक व सांस्कृतिक उपक्रम.',
      gallery_pill: 'छायाचित्रे • Photo Gallery',
      gallery_heading: 'गॅलरी — वर्षनिहाय कार्यक्रम व छायाचित्रे',
      gallery_sub: 'कार्यक्रम निवडा आणि त्यातील छायाचित्रे पहा.',
      upcoming: 'आगामी कार्यक्रम',
      past: 'संपन्न सोहळा',
      no_events: 'या शाखेचे कार्यक्रम लवकरच येथे अपडेट केले जातील.',
      view_all: (n) => `सर्व ${n} फोटो पहा (Expand All)`,
      collapse: 'कमी फोटो पहा (Collapse)'
    },
    hi: {
      back_main: 'मुख्य पोर्टल (सोनार समाज इंदौर)',
      nav_events: 'कार्यक्रम (Events)',
      nav_gallery: 'फोटो गैलरी (Gallery)',
      nav_indore: 'मुख्य इंदौर पोर्टल ↗',
      hero_badge: 'सोनार समाज आधिकारिक शाखा पोर्टल',
      cta_events: 'कार्यक्रम देखें (Events)',
      cta_gallery: 'फोटो गैलरी (Gallery)',
      events_pill: 'कार्यक्रम • Events',
      events_heading: 'आगामी एवं संपन्न कार्यक्रम',
      events_sub: 'इस शहर शाखा के सभी सामाजिक, धार्मिक व सांस्कृतिक कार्यक्रम।',
      gallery_pill: 'छायाचित्र • Photo Gallery',
      gallery_heading: 'गैलरी — वर्षवार कार्यक्रम एवं छायाचित्र',
      gallery_sub: 'कार्यक्रम चुनें और उसकी तस्वीरें देखें।',
      upcoming: 'आगामी कार्यक्रम',
      past: 'संपन्न समारोह',
      no_events: 'इस शाखा के कार्यक्रम जल्द ही अपडेट किए जाएंगे।',
      view_all: (n) => `सभी ${n} फोटो देखें (Expand All)`,
      collapse: 'कम फोटो दिखाएं (Collapse)'
    },
    en: {
      back_main: 'Main Portal (Sonar Samaj Indore)',
      nav_events: 'Events',
      nav_gallery: 'Photo Gallery',
      nav_indore: 'Main Indore Portal ↗',
      hero_badge: 'Official Sonar Samaj City Chapter',
      cta_events: 'View Events',
      cta_gallery: 'Photo Gallery',
      events_pill: 'Community Events',
      events_heading: 'Upcoming & Past Events',
      events_sub: 'Social, cultural, and community gatherings of this chapter.',
      gallery_pill: 'Photo Gallery',
      gallery_heading: 'Event Photo Gallery',
      gallery_sub: 'Select a year and album to browse photos.',
      upcoming: 'Upcoming',
      past: 'Completed',
      no_events: 'Events for this chapter will be updated soon.',
      view_all: (n) => `View All ${n} Photos`,
      collapse: 'Show Less (Collapse)'
    }
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveUrl(url) {
    if (!url) return '';
    if (url.startsWith('./src/')) return '/' + url.slice(2);
    if (url.startsWith('src/')) return '/' + url;
    return url;
  }

  function getCitySlug() {
    const params = new URLSearchParams(window.location.search);
    const qSlug = params.get('slug');
    if (qSlug) return qSlug.replace(/^\/+|\/+$/g, '').toLowerCase();
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'city' && parts[1]) return parts[1].toLowerCase();
    return '';
  }

  function pick(obj, base) {
    if (!obj) return '';
    return obj[`${base}_${currentLang}`] || obj[`${base}_mr`] || obj[`${base}_en`] || '';
  }

  function applyStaticStrings() {
    const dict = uiStrings[currentLang] || uiStrings.mr;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] && typeof dict[key] === 'string') {
        el.textContent = dict[key];
      }
    });
    ['mr', 'hi', 'en'].forEach(l => {
      const btn = document.getElementById(`lang-btn-${l}`);
      if (!btn) return;
      btn.className = l === currentLang
        ? 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-gold text-brand-900 transition-all'
        : 'px-2.5 py-0.5 rounded-full text-[11px] font-bold text-amber-100 hover:text-white transition-all';
    });
  }

  function renderCityHeaderAndHero() {
    if (!cityData) return;
    const name = pick(cityData, 'name');
    const tagline = pick(cityData, 'tagline');
    const mods = cityData.modules || {};
    document.title = `${cityData.name_mr} | ${cityData.name_en}`;
    document.getElementById('city-header-title').textContent = name;
    document.getElementById('city-header-subtitle').textContent = (uiStrings[currentLang] || uiStrings.mr).hero_badge;
    document.getElementById('city-hero-name').textContent = name;
    document.getElementById('city-hero-tagline').textContent = tagline || `${name} — ${(uiStrings[currentLang] || uiStrings.mr).events_sub}`;
    document.getElementById('city-footer-name').textContent = name;

    const cityLogoEl = document.getElementById('city-header-logo');
    if (cityLogoEl) {
      if (mods.logo_url) {
        cityLogoEl.src = resolveUrl(mods.logo_url);
        cityLogoEl.alt = name;
        cityLogoEl.classList.remove('hidden');
      } else {
        cityLogoEl.classList.add('hidden');
      }
    }

    const bannerWrap = document.getElementById('city-hero-banner-wrap');
    const bannerImg = document.getElementById('city-hero-banner-img');
    if (bannerWrap && bannerImg) {
      if (mods.banner_url) {
        bannerImg.src = resolveUrl(mods.banner_url);
        bannerImg.alt = name;
        bannerWrap.classList.remove('hidden');
      } else {
        bannerWrap.classList.add('hidden');
      }
    }
  }

  function renderEvents() {
    const grid = document.getElementById('city-events-grid');
    if (!grid) return;
    const dict = uiStrings[currentLang] || uiStrings.mr;

    if (!eventsList.length) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center bg-surface-pearl rounded-3xl border border-surface-border text-slate-500 text-sm marathi">${escapeHtml(dict.no_events)}</div>`;
      return;
    }

    grid.innerHTML = eventsList.map(ev => {
      const isUpcoming = ev.status !== 'past';
      const badgeClass = isUpcoming
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-amber-100 text-amber-900 border-amber-200';
      const cover = (Array.isArray(ev.photos) && ev.photos[0] && ev.photos[0].url) ? resolveUrl(ev.photos[0].url) : '';
      return `
        <article class="bg-white rounded-3xl border border-surface-border shadow-soft overflow-hidden flex flex-col justify-between hover:shadow-card transition-all">
          ${cover ? `<div class="h-44 bg-slate-100 overflow-hidden"><img src="${escapeHtml(cover)}" alt="${escapeHtml(pick(ev, 'title'))}" loading="lazy" class="w-full h-full object-cover"></div>` : ''}
          <div class="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeClass} marathi">${isUpcoming ? dict.upcoming : dict.past}</span>
                ${ev.date_display ? `<span class="text-xs font-bold text-slate-500"><i class="far fa-calendar-alt text-brand-500 mr-1"></i>${escapeHtml(ev.date_display)}</span>` : ''}
              </div>
              <h3 class="text-lg font-extrabold text-slate-900 marathi leading-snug mb-2">${escapeHtml(pick(ev, 'title'))}</h3>
              <p class="text-xs sm:text-sm text-slate-600 marathi leading-relaxed">${escapeHtml(pick(ev, 'description'))}</p>
            </div>
            ${ev.venue ? `<div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5 marathi"><i class="fas fa-location-dot text-brand-500"></i><span>${escapeHtml(ev.venue)}</span></div>` : ''}
          </div>
        </article>
      `;
    }).join('');
  }

  function renderGallery() {
    const yearsEl = document.getElementById('city-gallery-years');
    const albumsEl = document.getElementById('city-gallery-albums');
    const wsEl = document.getElementById('city-gallery-workspace');
    const emptyEl = document.getElementById('city-gallery-empty');
    if (!yearsEl || !albumsEl || !wsEl || !emptyEl) return;

    if (!galleryAlbums.length) {
      wsEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      yearsEl.innerHTML = '';
      albumsEl.innerHTML = '';
      return;
    }

    emptyEl.classList.add('hidden');
    wsEl.classList.remove('hidden');

    const years = [...new Set(galleryAlbums.map(a => String(a.year || '2026')))].sort((a, b) => b.localeCompare(a));
    if (!activeYear || !years.includes(activeYear)) activeYear = years[0];

    yearsEl.innerHTML = years.map(y => {
      const active = y === activeYear;
      return `<button type="button" onclick="selectCityYear('${escapeHtml(y)}')" class="px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${active ? 'bg-brand-600 text-white shadow-md ring-2 ring-amber-300' : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50'}">${escapeHtml(y)}</button>`;
    }).join('');

    const yearAlbums = galleryAlbums.filter(a => String(a.year || '2026') === activeYear);
    if (!activeAlbumId || !yearAlbums.some(a => a.id === activeAlbumId)) {
      activeAlbumId = yearAlbums[0] ? yearAlbums[0].id : '';
    }

    albumsEl.innerHTML = yearAlbums.map((a, idx) => {
      const active = a.id === activeAlbumId;
      const count = Array.isArray(a.photos) ? a.photos.length : 0;
      return `
        <button type="button" onclick="selectCityAlbum('${escapeHtml(a.id)}')" class="text-left p-4 rounded-2xl border transition-all ${active ? 'bg-amber-50 border-2 border-brand-500 shadow-sm' : 'bg-white border-slate-200 hover:border-amber-300'}">
          <div class="flex items-center justify-between text-[11px] mb-1.5">
            <span class="font-bold px-2 py-0.5 rounded-full ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}">#${idx + 1}</span>
            <span class="font-semibold text-slate-500"><i class="fas fa-camera text-amber-600 mr-1"></i>${count}</span>
          </div>
          <div class="font-bold text-sm text-slate-900 marathi line-clamp-2">${escapeHtml(pick(a, 'title'))}</div>
        </button>
      `;
    }).join('');

    const album = yearAlbums.find(a => a.id === activeAlbumId) || yearAlbums[0];
    if (!album) return;

    const photos = Array.isArray(album.photos) ? album.photos : [];
    document.getElementById('city-album-title').textContent = pick(album, 'title');
    document.getElementById('city-album-meta').textContent = [album.date_display, album.venue].filter(Boolean).join(' • ');
    document.getElementById('city-album-desc').textContent = pick(album, 'description');
    document.getElementById('city-album-count').textContent = `${photos.length} फोटो`;

    const grid = document.getElementById('city-photos-grid');
    const expandBar = document.getElementById('city-photos-expand-bar');
    const expandBtn = document.getElementById('city-photos-expand-btn');
    const dict = uiStrings[currentLang] || uiStrings.mr;

    if (!photos.length) {
      grid.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400 text-sm marathi">या अल्बममध्ये फोटो उपलब्ध नाहीत.</div>';
      expandBar.classList.add('hidden');
      return;
    }

    lightboxPhotos = photos;
    const hasMore = photos.length > PREVIEW_LIMIT;
    const shown = (hasMore && !photosExpanded) ? photos.slice(0, PREVIEW_LIMIT) : photos;

    grid.innerHTML = shown.map((p, idx) => {
      const cap = pick(p, 'caption') || pick(album, 'title');
      return `
        <div onclick="openCityLightbox(${idx})" class="group relative rounded-2xl overflow-hidden cursor-pointer border border-surface-border shadow-soft bg-slate-100 h-52">
          <img src="${escapeHtml(resolveUrl(p.url))}" alt="${escapeHtml(cap)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"></div>
          <div class="absolute bottom-2.5 left-3 right-3 text-white">
            <span class="text-[10px] font-bold bg-brand-600/90 px-2 py-0.5 rounded-full">#${idx + 1}</span>
            <p class="text-xs font-bold marathi line-clamp-1 mt-1">${escapeHtml(cap)}</p>
          </div>
        </div>
      `;
    }).join('');

    if (hasMore) {
      expandBar.classList.remove('hidden');
      expandBtn.innerHTML = photosExpanded
        ? `<i class="fas fa-chevron-up"></i> <span>${escapeHtml(dict.collapse)}</span>`
        : `<i class="fas fa-images"></i> <span>${escapeHtml(dict.view_all(photos.length))}</span>`;
    } else {
      expandBar.classList.add('hidden');
    }
  }

  window.setCityLang = function (lang) {
    currentLang = lang;
    localStorage.setItem('sonar_lang', lang);
    applyStaticStrings();
    renderCityHeaderAndHero();
    renderEvents();
    renderGallery();
  };

  window.selectCityYear = function (y) {
    activeYear = y;
    activeAlbumId = '';
    photosExpanded = false;
    renderGallery();
  };

  window.selectCityAlbum = function (id) {
    activeAlbumId = id;
    photosExpanded = false;
    renderGallery();
  };

  window.toggleCityPhotosExpand = function () {
    photosExpanded = !photosExpanded;
    renderGallery();
  };

  window.openCityLightbox = function (idx) {
    if (!lightboxPhotos.length) return;
    lightboxIdx = idx;
    updateLightbox();
    document.getElementById('city-lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  function updateLightbox() {
    const p = lightboxPhotos[lightboxIdx];
    if (!p) return;
    document.getElementById('city-lb-img').src = resolveUrl(p.url);
    document.getElementById('city-lb-caption').textContent = pick(p, 'caption') || `Photo ${lightboxIdx + 1}`;
    document.getElementById('city-lb-counter').textContent = `${lightboxIdx + 1} / ${lightboxPhotos.length}`;
  }

  window.stepCityLightbox = function (delta) {
    if (!lightboxPhotos.length) return;
    lightboxIdx = (lightboxIdx + delta + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightbox();
  };

  window.closeCityLightbox = function () {
    document.getElementById('city-lightbox').classList.add('hidden');
    document.body.style.overflow = '';
  };

  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('city-lightbox');
    if (!lb || lb.classList.contains('hidden')) return;
    if (e.key === 'Escape') window.closeCityLightbox();
    else if (e.key === 'ArrowRight') window.stepCityLightbox(1);
    else if (e.key === 'ArrowLeft') window.stepCityLightbox(-1);
  });

  async function init() {
    applyStaticStrings();
    const slug = getCitySlug();
    const loadingEl = document.getElementById('city-loading');
    const notFoundEl = document.getElementById('city-not-found');
    const mainEl = document.getElementById('city-main');

    if (!slug) {
      loadingEl.classList.add('hidden');
      notFoundEl.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`/.netlify/functions/cities?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      cityData = data.city;
      eventsList = Array.isArray(data.events) ? data.events : [];
      galleryAlbums = Array.isArray(data.gallery) ? data.gallery : [];

      loadingEl.classList.add('hidden');
      mainEl.classList.remove('hidden');
      renderCityHeaderAndHero();
      renderEvents();
      renderGallery();
    } catch (err) {
      loadingEl.classList.add('hidden');
      notFoundEl.classList.remove('hidden');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
