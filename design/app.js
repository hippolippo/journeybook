(function () {
  'use strict';

  var PHOTOS = {
    sunset: 'linear-gradient(160deg,#f6c98a,#e88f6f 55%,#c96f6f)',
    sea: 'linear-gradient(160deg,#bfe0e6,#8fb9c9 55%,#6f9fb0)',
    forest: 'linear-gradient(160deg,#c6d6a8,#9caf88 55%,#6f855f)',
    night: 'linear-gradient(160deg,#5b6b8a,#3f4a63 60%,#2c3448)',
    blush: 'linear-gradient(160deg,#f2cfc9,#e8b4af 55%,#d98c8c)',
    meadow: 'linear-gradient(160deg,#f4e3a8,#d9c46a 55%,#b7a44a)'
  };
  var STICKERS = { heart: 'sticker--heart', star: 'sticker--star', sparkle: 'sticker--sparkle' };
  var COVERS = ['rose', 'sage', 'mustard', 'terracotta', 'sky', 'kraft'];
  var NEXT_VISIT = '2026-11-19';

  function daysUntil(dateStr) {
    var target = new Date(dateStr + 'T00:00:00').getTime();
    var diff = Math.ceil((target - Date.now()) / 86400000);
    return diff > 0 ? diff : 0;
  }

  function zonedHM(tz, date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(date);
    var h = 0, m = 0;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'hour') h = parseInt(parts[i].value, 10);
      else if (parts[i].type === 'minute') m = parseInt(parts[i].value, 10);
    }
    return { h: h % 12, m: m };
  }
  function hourDeg(h12, m) { return (h12 % 12) * 30 + m * 0.5; }
  function setHand(el, deg) { if (el) el.style.transform = 'rotate(' + deg + 'deg)'; }
  function updateClock() {
    if (!root) return;
    var now = new Date();
    var ct = zonedHM('America/Chicago', now);
    var et = zonedHM('America/New_York', now);
    setHand(root.querySelector('[data-hand="ct"]'), hourDeg(ct.h, ct.m));
    setHand(root.querySelector('[data-hand="et"]'), hourDeg(et.h, et.m));
    setHand(root.querySelector('[data-hand="min"]'), et.m * 6);
  }

  var state = {
    nodes: JSON.parse(JSON.stringify(window.JB_SEED.nodes)),
    view: 'home',
    folderId: null,
    bookId: null,
    spread: 0,
    query: '',
    creating: null,
    editing: null,
    menuOpen: null
  };

  var root = null;
  var content = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function find(id) {
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i].id === id) return state.nodes[i];
    return null;
  }
  function childrenOf(parentId) {
    return state.nodes
      .filter(function (n) { return n.parentId === parentId; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function pathTo(id) {
    var chain = [], node = find(id), guard = 0;
    while (node && guard++ < 50) { chain.unshift(node); node = find(node.parentId); }
    return chain;
  }
  function maxOrder(parentId) {
    return childrenOf(parentId).reduce(function (m, n) { return Math.max(m, n.order); }, -1);
  }
  function countContents(folderId) {
    return childrenOf(folderId).length;
  }
  function makeId(prefix) { return prefix + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e3); }

  function createNode(type, parentId, title) {
    var node = {
      id: makeId(type),
      type: type,
      title: title,
      parentId: parentId,
      order: maxOrder(parentId) + 1
    };
    if (type === 'scrapbook') {
      node.cover = COVERS[Math.floor(Math.random() * COVERS.length)];
      node.pages = [];
    }
    state.nodes.push(node);
  }
  function renameNode(id, title) { var n = find(id); if (n) n.title = title; }
  function deleteNode(id) {
    var doomed = {};
    (function collect(root) {
      doomed[root] = true;
      state.nodes.filter(function (n) { return n.parentId === root; }).forEach(function (c) { collect(c.id); });
    })(id);
    state.nodes = state.nodes.filter(function (n) { return !doomed[n.id]; });
  }
  function addElement(bookId, pageIndex, element) {
    var book = find(bookId);
    if (!book) return;
    if (!book.pages) book.pages = [];
    if (!book.pages[pageIndex]) book.pages[pageIndex] = { id: makeId('pg'), elements: [] };
    book.pages[pageIndex].elements.push(element);
  }

  function visibleChildren(folderId) {
    var kids = childrenOf(folderId);
    if (!state.query) return kids;
    var q = state.query.toLowerCase();
    return kids.filter(function (n) { return n.title.toLowerCase().indexOf(q) !== -1; });
  }

  /* ---------- render: shared ---------- */

  function crumbsHTML(folderId) {
    var chain = pathTo(folderId);
    var parts = ['<button class="crumb" type="button" data-action="crumb" data-id="">Scrapbooks</button>'];
    chain.forEach(function (n) {
      parts.push('<span class="crumb-sep" aria-hidden="true">/</span>');
      parts.push('<button class="crumb" type="button" data-action="crumb" data-id="' + n.id + '"' +
        (n.id === folderId ? ' aria-current="true"' : '') + '>' + esc(n.title) + '</button>');
    });
    return '<nav class="crumbs" aria-label="Breadcrumb">' + parts.join('') + '</nav>';
  }

  function toolbarHTML() {
    return '' +
      '<div class="toolbar">' +
        '<button class="btn btn--primary" type="button" data-action="new-folder"><span class="icon icon--folder"></span>New folder</button>' +
        '<button class="btn btn--sage" type="button" data-action="new-book"><span class="icon icon--book"></span>New scrapbook</button>' +
      '</div>';
  }

  function menuHTML(node) {
    if (state.menuOpen !== node.id) return '';
    return '<div class="tile-pop" data-pop="' + node.id + '">' +
      '<button type="button" data-action="rename" data-id="' + node.id + '"><span class="icon icon--pencil"></span>Rename</button>' +
      '<button type="button" class="is-danger" data-action="delete" data-id="' + node.id + '"><span class="icon icon--trash"></span>Delete</button>' +
    '</div>';
  }

  function menuButtonHTML(node) {
    return '<span class="tile-menu" role="button" tabindex="0" aria-label="More options for ' + esc(node.title) +
      '" data-action="toggle-menu" data-id="' + node.id + '"><span class="icon icon--menu"></span></span>';
  }

  function folderTileHTML(node) {
    var count = countContents(node.id);
    return '<div class="tile" data-title="' + esc(node.title.toLowerCase()) + '" data-action="open-folder" data-id="' + node.id + '" role="button" tabindex="0">' +
      '<div class="folder">' +
        '<span class="folder__peek" aria-hidden="true"></span>' +
        '<span class="folder__peek folder__peek--2" aria-hidden="true"></span>' +
        '<span class="folder__meta">' + count + ' ' + (count === 1 ? 'thing' : 'things') + '</span>' +
        '<span class="folder__title">' + esc(node.title) + '</span>' +
      '</div>' +
      menuButtonHTML(node) +
      menuHTML(node) +
    '</div>';
  }

  function bookTileHTML(node) {
    var pages = (node.pages || []).length;
    return '<div class="tile" data-title="' + esc(node.title.toLowerCase()) + '" data-action="open-book" data-id="' + node.id + '" role="button" tabindex="0">' +
      '<div class="book" data-cover="' + esc(node.cover || 'rose') + '">' +
        '<span class="tape" aria-hidden="true"></span>' +
        '<span class="book__label"><span class="book__title">' + esc(node.title) + '</span></span>' +
        '<span class="book__meta">' + pages + ' ' + (pages === 1 ? 'page' : 'pages') + '</span>' +
      '</div>' +
      menuButtonHTML(node) +
      menuHTML(node) +
    '</div>';
  }

  function createTileHTML(kind) {
    var label = kind === 'folder' ? 'New folder' : 'New scrapbook';
    var icon = kind === 'folder' ? 'icon--folder' : 'icon--book';
    return '<button class="tile create-tile" type="button" data-action="' + (kind === 'folder' ? 'new-folder' : 'new-book') + '">' +
      '<span class="icon ' + icon + '"></span><span class="create-tile__label">' + label + '</span></button>';
  }

  function createFormHTML(kind) {
    var label = kind === 'folder' ? 'Name your folder' : 'Name your scrapbook';
    return '<form class="create-form" data-action="create-submit">' +
      '<label for="jb-new">' + label + '</label>' +
      '<input id="jb-new" name="title" type="text" placeholder="e.g. ' + (kind === 'folder' ? 'Summer 2024' : 'Our first trip') + '" autocomplete="off" required>' +
      '<div class="row"><button class="btn btn--primary btn--small" type="submit">Create</button>' +
      '<button class="btn btn--ghost btn--small" type="button" data-action="cancel-create">Cancel</button></div>' +
    '</form>';
  }

  /* ---------- render: screens ---------- */

  function roomShellHTML() {
    var motes = '';
    for (var i = 0; i < 8; i++) motes += '<span class="mote"></span>';
    var days = daysUntil(NEXT_VISIT);
    return '' +
      '<div class="room">' +
        '<div class="room__wall"></div>' +
        '<div class="room__floor"></div>' +
        '<div class="room__baseboard"></div>' +
        '<div class="room__vignette"></div>' +
        '<div class="room__decor" aria-hidden="true">' +
          '<img class="room__lights" src="assets/svg/string-lights.svg" alt="">' +
          '<img class="room__lights room__lights--r" src="assets/svg/string-lights.svg" alt="">' +
          '<span class="room__window-set">' +
            '<img class="room__window" src="assets/svg/window-cozy.svg" alt="">' +
            '<img class="room__curtain room__curtain--l" src="assets/svg/curtain.svg" alt="">' +
            '<img class="room__curtain room__curtain--r" src="assets/svg/curtain.svg" alt="">' +
          '</span>' +
          '<span class="room__clock" role="img" aria-label="Wall clock: pink hand is Central time, blue hand is Eastern time">' +
            '<img class="room__clock-face" src="assets/svg/wall-clock.svg" alt="">' +
            '<span class="clock-hand clock-hand--min" data-hand="min"></span>' +
            '<span class="clock-hand clock-hand--h-ct" data-hand="ct"></span>' +
            '<span class="clock-hand clock-hand--h-et" data-hand="et"></span>' +
            '<span class="clock-pivot"></span>' +
          '</span>' +
          '<img class="room__shelf" src="assets/svg/wall-shelf.svg" alt="">' +
          '<img class="room__corkboard" src="assets/svg/corkboard.svg" alt="">' +
        '</div>' +
        '<div class="room__dust" aria-hidden="true">' + motes + '</div>' +
        '<div class="room__ground" aria-hidden="true">' +
          '<img class="room__rug" src="assets/svg/rug.svg" alt="">' +
          '<div class="room__desk-area">' +
            '<img class="room__desk-svg" src="assets/svg/desk.svg" alt="">' +
            '<span class="room__desk-item room__desk-item--cup"><img src="assets/svg/pencil-cup.svg" alt=""></span>' +
            '<span class="room__desk-item room__desk-item--mug"><span class="steam steam--1"></span><span class="steam steam--2"></span><img src="assets/svg/mug-tea.svg" alt=""></span>' +
            '<span class="room__desk-item room__desk-item--laptop"><img src="assets/svg/laptop.svg" alt=""></span>' +
            '<span class="room__desk-item room__desk-item--owala"><img src="assets/svg/owala.svg" alt=""></span>' +
            '<span class="room__desk-item room__desk-item--scissors"><img src="assets/svg/scissors.svg" alt=""></span>' +
            '<span class="room__desk-item room__desk-item--plant"><img src="assets/svg/potted-plant.svg" alt=""></span>' +
          '</div>' +
          '<div class="room__beanbag-area">' +
            '<img class="room__beanbag" src="assets/svg/beanbag.svg" alt="">' +
            '<img class="room__raccoon" src="assets/svg/raccoon-sleeping.svg" alt="">' +
          '</div>' +
        '</div>' +
        '<div class="app-shell">' +
          '<header class="roombar">' +
            '<button class="roombar__brand" type="button" data-action="go-home">' +
              '<span class="icon icon--home"></span>' +
              '<span class="roombar__title hand">our little room</span></button>' +
            '<div class="roombar__right">' +
              '<span class="countdown" title="until we are together again">' +
                '<span class="countdown__num">' + days + '</span>' +
                '<span class="countdown__txt">days until we are together ♥</span>' +
              '</span>' +
              '<span class="people" aria-label="you and me">' +
                '<span class="avatar avatar--a"><span class="icon icon--heart"></span></span>' +
                '<span class="avatar avatar--b"><span class="icon icon--star"></span></span>' +
              '</span>' +
            '</div>' +
          '</header>' +
          '<div class="content" data-jb-content></div>' +
        '</div>' +
      '</div>';
  }

  function renderHome() {
    return '' +
      '<section class="home">' +
        '<p class="tag">a little home just for two</p>' +
        '<h1 class="home__greeting">Welcome back, you two</h1>' +
        '<p class="home__tagline">what shall we remember today?</p>' +
        '<div class="shelf">' +
          '<button class="hero-book" type="button" data-action="open-scrapbooks">' +
            '<span class="tape hero-book__tape" aria-hidden="true"></span>' +
            '<img class="hero-book__heart" src="assets/svg/doodle-heart.svg" alt="" aria-hidden="true">' +
            '<img class="hero-book__flower" src="assets/svg/pressed-flower.svg" alt="" aria-hidden="true">' +
            '<span class="hero-book__label"><h1>Scrapbooks</h1><p>our memories, tucked in safe</p></span>' +
          '</button>' +
        '</div>' +
        '<div class="soon" aria-label="Coming soon">' +
          '<span class="soon__item">Notes <span class="icon icon--pencil"></span></span>' +
          '<span class="soon__item">Games <img src="assets/svg/doodle-star.svg" alt="" aria-hidden="true" style="width:1.2em;height:1.2em"></span>' +
          '<span class="soon__item">Camera <span class="icon icon--camera"></span></span>' +
        '</div>' +
      '</section>';
  }

  function renderOrganizer() {
    var folder = state.folderId ? find(state.folderId) : null;
    var title = folder ? folder.title : 'Scrapbooks';
    var kids = visibleChildren(state.folderId);
    var arr = kids.map(function (n) {
      return n.type === 'folder' ? folderTileHTML(n) : bookTileHTML(n);
    });
    if (state.creating) arr.unshift(createFormHTML(state.creating.type));
    var half = Math.ceil(arr.length / 2);
    var ordered = [];
    for (var r = 0; r < half; r++) {
      if (arr[r]) ordered.push(arr[r]);
      if (arr[r + half]) ordered.push(arr[r + half]);
    }
    var items = ordered.join('');

    var body;
    if (kids.length === 0 && !state.creating) {
      body = '<div class="items-wrap"><div class="empty">' +
        '<img src="assets/svg/pressed-flower.svg" alt="" aria-hidden="true">' +
        '<h3>This room is empty</h3><p>Make your first folder or scrapbook?</p></div></div>';
    } else {
      body = '<div class="items-wrap">' +
        '<button class="items-arrow items-arrow--prev" type="button" data-action="items-prev" aria-label="More to the left" hidden><span class="icon icon--chev-left"></span></button>' +
        '<div class="tiles" id="jb-tiles" data-tiles>' + items + '</div>' +
        '<button class="items-arrow items-arrow--next" type="button" data-action="items-next" aria-label="More to the right" hidden><span class="icon icon--chev-right"></span></button>' +
        '</div>';
    }

    return '' +
      '<h1 class="sr-only">' + esc(title) + '</h1>' +
      crumbsHTML(state.folderId) +
      toolbarHTML() +
      body;
  }

  function parentLabel(folder) {
    var p = find(folder.parentId);
    return p ? p.title : 'Scrapbooks';
  }

  function perView() {
    return window.matchMedia('(max-width: 720px)').matches ? 1 : 2;
  }

  function renderInterior() {
    var book = find(state.bookId);
    if (!book) { state.view = 'organizer'; return renderOrganizer(); }
    var pages = book.pages || [];
    var pv = perView();
    var lastStart = Math.max(0, pages.length - pv);
    var i = Math.min(state.spread, lastStart);
    if (i < 0) i = 0;

    var cols = '';
    for (var k = 0; k < pv; k++) {
      var pg = pages[i + k];
      var emptyWhole = pages.length === 0 && k === 0;
      cols += '<div class="page">' + (pg ? pageHTML(pg) : emptyPageHTML(emptyWhole)) + '</div>';
    }

    var endPage = Math.min(i + pv, pages.length);
    var label = pages.length === 0 ? 'blank book' :
      (pv === 1
        ? 'page ' + (i + 1) + ' of ' + pages.length
        : 'pages ' + (i + 1) + (endPage > i + 1 ? '–' + endPage : '') + ' of ' + pages.length);

    return '' +
      '<header class="topbar">' +
        '<button class="backlink" type="button" data-action="back"><span class="icon icon--back"></span>' + esc(parentLabel(book)) + '</button>' +
        '<span class="toolbar-spacer"></span>' +
        '<span class="tag">' + esc(book.title) + '</span>' +
      '</header>' +
      '<div class="spread">' + cols + '</div>' +
      '<div class="book-controls">' +
        '<div class="page-nav">' +
          '<button class="page-nav__btn" type="button" data-action="prev-spread"' + (i <= 0 ? ' disabled' : '') + '><span class="icon icon--chev-left"></span></button>' +
          '<span class="page-nav__label">' + esc(label) + '</span>' +
          '<button class="page-nav__btn" type="button" data-action="next-spread"' + (i >= lastStart ? ' disabled' : '') + '><span class="icon icon--chev-right"></span></button>' +
        '</div>' +
        '<div class="add-bar">' +
          '<button class="btn btn--small" type="button" data-action="add-photo"><span class="icon icon--camera"></span>Add photo</button>' +
          '<button class="btn btn--small" type="button" data-action="add-note"><span class="icon icon--pencil"></span>Add note</button>' +
          '<button class="btn btn--small" type="button" data-action="add-sticker"><span class="icon icon--star"></span>Add sticker</button>' +
        '</div>' +
      '</div>';
  }

  function emptyPageHTML(whole) {
    return '<div class="empty" style="border-style:dashed;padding:2rem 1rem;background:transparent">' +
      '<img src="assets/svg/polaroid-empty.svg" alt="" aria-hidden="true">' +
      '<h3>' + (whole ? 'A blank book' : 'Room for more') + '</h3>' +
      '<p>' + (whole ? 'Add your first memory?' : 'Keep going — add a memory.') + '</p></div>';
  }

  function pageHTML(page) {
    return (page.elements || []).map(elementHTML).join('');
  }

  function elementHTML(el, idx) {
    if (el.kind === 'photo') {
      return '<div class="page__el polaroid" style="--rot:' + (el.rot || 0) + 'deg">' +
        '<span class="tape" aria-hidden="true"></span>' +
        '<span class="polaroid__photo" style="background:' + (PHOTOS[el.photo] || PHOTOS.sunset) + '"></span>' +
        '<div class="polaroid__cap">' + esc(el.caption || '') + '</div></div>';
    }
    if (el.kind === 'note') {
      return '<div class="page__el sticky" style="--rot:' + (el.rot || 0) + 'deg">' + esc(el.text) + '</div>';
    }
    if (el.kind === 'sticker') {
      return '<div class="page__el sticker ' + (STICKERS[el.icon] || STICKERS.heart) + '" style="transform:rotate(' + (el.rot || 0) + 'deg)"></div>';
    }
    return '';
  }

  /* ---------- dispatcher ---------- */

  function updateItemsArrows() {
    var tiles = content.querySelector('[data-tiles]');
    if (!tiles) return;
    var wrap = tiles.closest('.items-wrap');
    if (!wrap) return;
    var prev = wrap.querySelector('.items-arrow--prev');
    var next = wrap.querySelector('.items-arrow--next');
    var overflow = tiles.scrollWidth > tiles.clientWidth + 1;
    if (prev) prev.hidden = !overflow || tiles.scrollLeft <= 1;
    if (next) next.hidden = !overflow || tiles.scrollLeft + tiles.clientWidth >= tiles.scrollWidth - 1;
  }

  function render() {
    if (state.view === 'home') content.innerHTML = renderHome();
    else if (state.view === 'interior') content.innerHTML = renderInterior();
    else content.innerHTML = renderOrganizer();
    if (state.view === 'organizer') {
      var tiles = content.querySelector('[data-tiles]');
      if (tiles) {
        tiles.addEventListener('scroll', updateItemsArrows, { passive: true });
        updateItemsArrows();
      }
    }
    var input = content.querySelector('#jb-new');
    if (input) input.focus();
  }

  function renderTop() { render(); window.scrollTo(0, 0); }

  function openScrapbooks() { state.view = 'organizer'; state.query = ''; state.menuOpen = null; renderTop(); }
  function openFolder(id) { state.view = 'organizer'; state.folderId = id; state.query = ''; state.creating = null; state.menuOpen = null; renderTop(); }
  function openBook(id) { state.view = 'interior'; state.bookId = id; state.spread = 0; state.menuOpen = null; renderTop(); }

  function goBack() {
    if (state.view === 'interior') {
      var book = find(state.bookId);
      openFolder(book ? book.parentId : null);
    } else if (state.view === 'organizer') {
      var folder = state.folderId ? find(state.folderId) : null;
      if (folder && folder.parentId) openFolder(folder.parentId);
      else { state.view = 'home'; renderTop(); }
    } else {
      render();
    }
  }

  function onClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) {
      if (state.menuOpen) { state.menuOpen = null; render(); }
      return;
    }
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');

    switch (action) {
      case 'go-home': state.view = 'home'; state.query = ''; state.menuOpen = null; renderTop(); break;
      case 'open-scrapbooks': openScrapbooks(); break;
      case 'open-folder': openFolder(id); break;
      case 'open-book': openBook(id); break;
      case 'crumb': openFolder(id || null); break;
      case 'back': goBack(); break;
      case 'new-folder': state.creating = { type: 'folder' }; state.menuOpen = null; render(); break;
      case 'new-book': state.creating = { type: 'scrapbook' }; state.menuOpen = null; render(); break;
      case 'cancel-create': state.creating = null; render(); break;
      case 'toggle-menu': e.stopPropagation(); state.menuOpen = (state.menuOpen === id ? null : id); render(); break;
      case 'rename': {
        var n = find(id);
        var next = window.prompt('Rename to…', n ? n.title : '');
        if (next && next.trim()) renameNode(id, next.trim());
        state.menuOpen = null; render(); break;
      }
      case 'delete': {
        var node = find(id);
        if (node && window.confirm('Delete "' + node.title + '"' + (node.type === 'folder' ? ' and everything inside' : '') + '?')) deleteNode(id);
        state.menuOpen = null; render(); break;
      }
      case 'items-prev': {
        var tp = content.querySelector('[data-tiles]');
        if (tp) tp.scrollBy({ left: -Math.round(tp.clientWidth * 0.85), behavior: 'smooth' });
        break;
      }
      case 'items-next': {
        var tn = content.querySelector('[data-tiles]');
        if (tn) tn.scrollBy({ left: Math.round(tn.clientWidth * 0.85), behavior: 'smooth' });
        break;
      }
      case 'prev-spread': state.spread = Math.max(0, state.spread - perView()); render(); break;
      case 'next-spread': state.spread = state.spread + perView(); render(); break;
      case 'add-photo': addElement(state.bookId, state.spread, { kind: 'photo', photo: 'sunset', caption: 'new memory', rot: -2 }); render(); break;
      case 'add-note': addElement(state.bookId, state.spread, { kind: 'note', text: 'Write something sweet…', rot: 2 }); render(); break;
      case 'add-sticker': addElement(state.bookId, state.spread, { kind: 'sticker', icon: 'heart', rot: -6 }); render(); break;
      default: break;
    }
  }

  function onSubmit(e) {
    var form = e.target.closest('[data-action="create-submit"]');
    if (!form) return;
    e.preventDefault();
    var title = (new FormData(form).get('title') || '').toString().trim();
    if (!title) return;
    createNode(state.creating.type, state.folderId, title);
    state.creating = null;
    render();
  }

  function onKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (!t || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
    var el = t.closest ? t.closest('[data-action]') : null;
    if (!el) return;
    if (el.tagName === 'BUTTON') return;
    e.preventDefault();
    el.click();
  }

  function start(screen) {
    root = document.querySelector('[data-jb-app]');
    if (!root) return;
    root.innerHTML = roomShellHTML();
    content = root.querySelector('[data-jb-content]');
    updateClock();
    setInterval(updateClock, 30000);
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', function () {
      if (state.view === 'interior') render();
      else updateItemsArrows();
    });

    if (screen === 'home') { state.view = 'home'; render(); }
    else if (screen === 'scrapbook') { state.view = 'organizer'; state.folderId = null; render(); }
    else if (screen === 'interior') { state.view = 'interior'; state.bookId = 'b4'; state.spread = 0; render(); }
    else if (screen === 'folder') { state.view = 'organizer'; state.folderId = 'f1'; render(); }
    else {
      var hash = (location.hash || '').replace(/^#\/?/, '');
      var m;
      if ((m = hash.match(/^book\/(.+)$/))) { openBook(m[1]); }
      else if ((m = hash.match(/^folder\/(.*)$/))) { state.view = 'organizer'; state.folderId = m[1] || null; render(); }
      else { state.view = 'home'; render(); }
      window.addEventListener('hashchange', function () {
        var h = (location.hash || '').replace(/^#\/?/, '');
        var mm;
        if ((mm = h.match(/^book\/(.+)$/))) openBook(mm[1]);
        else if ((mm = h.match(/^folder\/(.*)$/))) openFolder(mm[1] || null);
        else { state.view = 'home'; render(); }
      });
    }
  }

  window.JB = { start: start };
})();
