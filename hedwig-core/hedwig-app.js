/**
 * hedwig-app.js
 * Core application logic for Hedwig.
 * Handles: manifest loading, routing, theme, sidebar, markdown rendering.
 */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────
  const state = {
    courses: [],
    currentCourse: null,
    currentFile: null,
    theme: localStorage.getItem('hedwig-theme') || 'dark',
    sidebarOpen: false,
  };

  // ─── DOM References ───────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let els = {};

  function cacheEls() {
    els = {
      app:            $('#app'),
      header:         $('#header'),
      sidebar:        $('#sidebar'),
      sidebarContent: $('#sidebar-content'),
      sidebarHeader:  $('#sidebar-header-title'),
      main:           $('#main'),
      homeView:       $('#home-view'),
      readerView:     $('#reader-view'),
      readerContent:  $('#reader-content'),
      breadcrumb:     $('#breadcrumb'),
      themeBtn:       $('#theme-btn'),
      menuBtn:        $('#menu-btn'),
      overlay:        $('#sidebar-overlay'),
      homeGrid:       $('#home-grid'),
    };
  }

  // ─── Theme ────────────────────────────────────────────────────────────────
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('hedwig-theme', theme);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    if (!els.themeBtn) return;
    els.themeBtn.innerHTML = state.theme === 'dark' ? iconSun() : iconMoon();
    els.themeBtn.title = state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ─── Sidebar Mobile ───────────────────────────────────────────────────────
  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    els.sidebar.classList.toggle('open', state.sidebarOpen);
    els.overlay.classList.toggle('visible', state.sidebarOpen);
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    els.sidebar.classList.remove('open');
    els.overlay.classList.remove('visible');
  }

  // ─── Manifest Loading ─────────────────────────────────────────────────────
  async function loadManifest() {
    try {
      const res = await fetch('./manifest.json');
      if (!res.ok) throw new Error('manifest.json not found');
      const data = await res.json();
      state.courses = data.courses || [];
    } catch (e) {
      console.error('[Hedwig] Failed to load manifest.json:', e);
      state.courses = [];
    }
  }

  // ─── File Fetching ────────────────────────────────────────────────────────
  async function fetchMarkdown(coursePath, filePath) {
    // Build URL relative to hedwig-core
    const url = `${coursePath}/${filePath}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      throw new Error(`Could not load: ${url}\n\nIf running locally, please use a local server (see README).`);
    }
  }

  // ─── Routing (hash-based) ─────────────────────────────────────────────────
  function parseHash() {
    const hash = location.hash.slice(1);
    if (!hash) return { view: 'home' };
    const parts = hash.split('/');
    if (parts.length === 1) return { view: 'course', courseId: decodeURIComponent(parts[0]) };
    return {
      view: 'reader',
      courseId: decodeURIComponent(parts[0]),
      file: decodeURIComponent(parts.slice(1).join('/'))
    };
  }

  function navigate(hash) {
    location.hash = hash;
  }

  function handleRoute() {
    const route = parseHash();
    if (route.view === 'home') {
      showHome();
    } else if (route.view === 'course') {
      const course = state.courses.find(c => c.id === route.courseId);
      if (course) openCourse(course);
      else showHome();
    } else if (route.view === 'reader') {
      const course = state.courses.find(c => c.id === route.courseId);
      if (course) openFile(course, route.file);
      else showHome();
    }
  }

  // ─── Views ────────────────────────────────────────────────────────────────
  function showHome() {
    state.currentCourse = null;
    state.currentFile = null;
    els.homeView.classList.remove('hidden');
    els.readerView.classList.remove('visible');
    renderSidebarHome();
    updateBreadcrumb([]);
  }

  function openCourse(course) {
    state.currentCourse = course;
    state.currentFile = null;
    // Open first file
    if (course.sections && course.sections.length) {
      const first = findFirstFile(course.sections);
      if (first) {
        navigate(`${course.id}/${first}`);
        return;
      }
    }
    renderSidebarCourse(course);
    els.homeView.classList.add('hidden');
    els.readerView.classList.add('visible');
    els.readerContent.innerHTML = renderEmptyReader();
  }

  function findFirstFile(sections) {
    for (const section of sections) {
      if (section.file) return section.file;
      if (section.children) {
        const found = findFirstFile(section.children);
        if (found) return found;
      }
    }
    return null;
  }

  async function openFile(course, file) {
    state.currentCourse = course;
    state.currentFile = file;

    els.homeView.classList.add('hidden');
    els.readerView.classList.add('visible');
    els.readerContent.innerHTML = renderLoading();

    renderSidebarCourse(course, file);
    updateBreadcrumb([
      { label: course.title, hash: `${course.id}` },
      { label: fileLabel(course, file), current: true }
    ]);

    closeSidebar();

    try {
      const md = await fetchMarkdown(course.path, file);
      const html = HedwigMD.parse(md);
      els.readerContent.innerHTML = `<div class="markdown-body fade-in">${html}</div>`;
      fixInternalLinks(course);
      els.main.scrollTop = 0;
    } catch (e) {
      els.readerContent.innerHTML = renderError(e.message);
    }
  }

  // Make internal markdown links work within the reader
  function fixInternalLinks(course) {
    const links = els.readerContent.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href.startsWith('http') || href.startsWith('#')) return;
      // It's a relative .md link — rewrite as hash route
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const resolved = resolveRelativePath(state.currentFile, href);
        navigate(`${course.id}/${resolved}`);
      });
    });
  }

  function resolveRelativePath(currentFile, relativePath) {
    const base = currentFile.split('/').slice(0, -1).join('/');
    if (!base) return relativePath;
    return base + '/' + relativePath;
  }

  function fileLabel(course, file) {
    if (!course.sections) return file;
    const found = findLabelInSections(course.sections, file);
    return found || file.split('/').pop().replace('.md', '');
  }

  function findLabelInSections(sections, file) {
    for (const s of sections) {
      if (s.file === file) return s.title;
      if (s.children) {
        const found = findLabelInSections(s.children, file);
        if (found) return found;
      }
    }
    return null;
  }

  // ─── Breadcrumb ───────────────────────────────────────────────────────────
  function updateBreadcrumb(items) {
    if (!items.length) {
      els.breadcrumb.innerHTML = '';
      return;
    }
    const parts = items.map((item, i) => {
      if (item.current) {
        return `<span class="breadcrumb-item current">${escHtml(item.label)}</span>`;
      }
      return `<span class="breadcrumb-item" data-hash="${item.hash}" style="cursor:pointer;color:var(--text-muted)">${escHtml(item.label)}</span>`;
    });
    els.breadcrumb.innerHTML = parts.join('<span class="breadcrumb-sep">/</span>');
    els.breadcrumb.querySelectorAll('[data-hash]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.hash));
    });
  }

  // ─── Sidebar Rendering ────────────────────────────────────────────────────
  function renderSidebarHome() {
    els.sidebarHeader.textContent = 'Courses';
    if (!state.courses.length) {
      els.sidebarContent.innerHTML = `<div style="padding:16px;font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);line-height:1.6;">No courses found.<br>Add entries to manifest.json</div>`;
      return;
    }
    const cards = state.courses.map(c => `
      <div class="course-card" data-course-id="${c.id}">
        <div class="course-card-top">
          <div class="course-card-dot" style="background:${c.color || 'var(--accent)'}"></div>
          <div class="course-card-info">
            <div class="course-card-title">${escHtml(c.title)}</div>
            <div class="course-card-institution">${escHtml(c.institution || '')}</div>
          </div>
        </div>
      </div>
    `).join('');
    els.sidebarContent.innerHTML = `<div class="course-list">${cards}</div>`;
    els.sidebarContent.querySelectorAll('[data-course-id]').forEach(el => {
      el.addEventListener('click', () => {
        navigate(el.dataset.courseId);
      });
    });
  }

  function renderSidebarCourse(course, activeFile) {
    els.sidebarHeader.textContent = course.title;

    const backBtn = `<div class="sidebar-back" id="sidebar-back">
      ${iconArrowLeft()}
      <span>All Courses</span>
    </div>`;

    const toc = renderTOC(course.sections || [], course.id, activeFile);
    els.sidebarContent.innerHTML = backBtn + toc;

    $('#sidebar-back').addEventListener('click', () => navigate(''));
    els.sidebarContent.querySelectorAll('[data-file]').forEach(el => {
      el.addEventListener('click', () => {
        navigate(`${course.id}/${el.dataset.file}`);
      });
    });

    // Group toggles
    els.sidebarContent.querySelectorAll('.toc-group-toggle').forEach(el => {
      const childrenEl = el.nextElementSibling;
      const chevron = el.querySelector('.toc-chevron');
      const isOpen = childrenEl && childrenEl.style.maxHeight !== '0px';
      if (childrenEl) {
        childrenEl.style.maxHeight = isOpen ? '1000px' : '0px';
        if (chevron) chevron.classList.toggle('open', isOpen);
      }
      el.addEventListener('click', () => {
        const open = childrenEl.style.maxHeight !== '0px';
        childrenEl.style.maxHeight = open ? '0px' : '1000px';
        if (chevron) chevron.classList.toggle('open', !open);
      });
    });
  }

  function renderTOC(sections, courseId, activeFile) {
    return sections.map(section => {
      if (section.file) {
        const isActive = section.file === activeFile;
        return `<div class="toc-item${isActive ? ' active' : ''}" data-file="${section.file}">${escHtml(section.title)}</div>`;
      }
      if (section.children) {
        // Check if any child is active
        const hasActive = section.children.some(c => c.file === activeFile);
        const children = section.children.map(c => {
          const isActive = c.file === activeFile;
          return `<div class="toc-item${isActive ? ' active' : ''}" data-file="${c.file}">${escHtml(c.title)}</div>`;
        }).join('');
        return `
          <div class="toc-section">
            <div class="toc-group-toggle">
              <span>${escHtml(section.title)}</span>
              <svg class="toc-chevron${hasActive ? ' open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="toc-group-children" style="max-height:${hasActive ? '1000px' : '0px'}">
              <div class="toc-children">${children}</div>
            </div>
          </div>`;
      }
      // Just a label
      return `<div class="toc-section-label">${escHtml(section.title)}</div>`;
    }).join('');
  }

  // ─── Home Grid ────────────────────────────────────────────────────────────
  function renderHomeGrid() {
    if (!state.courses.length) {
      els.homeGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No courses yet.</div>
          <div class="empty-state-sub">Add a course folder and register it in <code>hedwig-core/manifest.json</code>.</div>
        </div>`;
      return;
    }
    els.homeGrid.innerHTML = state.courses.map(c => `
      <div class="home-course-card" data-course-id="${c.id}" style="--course-color:${c.color || 'var(--accent)'}">
        <div class="home-card-institution">${escHtml(c.institution || '')}</div>
        <div class="home-card-title">${escHtml(c.title)}</div>
        <div class="home-card-desc">${escHtml(c.description || '')}</div>
      </div>
    `).join('');
    els.homeGrid.querySelectorAll('[data-course-id]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.courseId));
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderLoading() {
    return `<div class="content-loading">
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <span>Loading</span>
    </div>`;
  }

  function renderError(msg) {
    return `<div class="content-error"><strong>Could not load file.</strong><br><br>${escHtml(msg)}</div>`;
  }

  function renderEmptyReader() {
    return `<div class="content-loading" style="color:var(--text-muted)">Select a file from the sidebar.</div>`;
  }

  // ─── Icons (inline SVG) ───────────────────────────────────────────────────
  function iconSun() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }

  function iconMoon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }

  function iconArrowLeft() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
  }

  function iconMenu() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    cacheEls();
    applyTheme(state.theme);

    els.themeBtn.addEventListener('click', toggleTheme);
    els.menuBtn.addEventListener('click', toggleSidebar);
    els.overlay.addEventListener('click', closeSidebar);

    // Logo click goes home
    document.getElementById('logo').addEventListener('click', () => navigate(''));

    await loadManifest();
    renderHomeGrid();
    renderSidebarHome();

    // Hash routing
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
