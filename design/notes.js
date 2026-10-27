// Journeybook — Notes mockup.
// In-memory/sessionStorage only. The letter model, papers, pens and envelope
// options mirror the intended shipping shape; nothing here is wired to the
// real app or a backend.
(function () {
  'use strict';

  var D = window.JB_NOTES;
  var KEY = 'journeybook:notes-mock:v1';
  var PAGE_WIDTH = 480;
  var MIN_HEIGHT = 380;
  var MAX_HEIGHT = 1100;
  var RULE = 32;

  var state = loadState();

  // ---------------------------------------------------------------- state

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function seed() {
    return {
      viewerId: 'wren',
      screen: 'home',
      tab: 'inbox',
      noteId: null,
      composeNoteId: null,
      composeTab: 'letter',
      confirmSend: false,
      email: null,
      emailOpen: false,
      panelOpen: false,
      focusEditor: false,
      notes: clone(D.notes),
    };
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.notes)) return parsed;
      }
    } catch (error) {
      /* sessionStorage can be unavailable; the mockup still works in memory */
    }
    return seed();
  }

  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      /* ignore quota/privacy failures */
    }
  }

  function reset() {
    try {
      sessionStorage.removeItem(KEY);
    } catch (error) {
      /* ignore */
    }
    state = seed();
    render();
    toast('Mockup reset to the seeded letters.');
  }

  // ---------------------------------------------------------------- helpers

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function plain(html) {
    var node = document.createElement('div');
    node.innerHTML = (html || '')
      .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ');
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function preview(html, max) {
    var text = plain(html);
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd() + '…';
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var seconds = Math.max(0, (Date.now() - ts) / 1000);
    if (seconds < 90) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.round(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function dayLabel(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function initials(name) {
    return String(name || '?').trim().charAt(0).toUpperCase();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function userById(id) {
    return D.users.find(function (user) { return user.id === id; }) || D.users[0];
  }

  function currentUser() {
    return userById(state.viewerId);
  }

  function partnerOf(id) {
    return D.users.find(function (user) { return user.id !== id; }) || D.users[0];
  }

  function paperById(id) {
    return D.papers.find(function (paper) { return paper.id === id; }) || D.papers[0];
  }

  function stampById(id) {
    return D.stamps.find(function (stamp) { return stamp.id === id; }) || D.stamps[0];
  }

  function noteById(id) {
    return state.notes.find(function (note) { return note.id === id; }) || null;
  }

  function liveNotes() {
    return state.notes.filter(function (note) { return !note.trashedAt; });
  }

  function inboxOf(userId) {
    return liveNotes()
      .filter(function (note) { return note.status === 'sent' && note.recipientId === userId; })
      .sort(function (a, b) { return b.sentAt - a.sentAt; });
  }

  function outboxOf(userId) {
    return liveNotes()
      .filter(function (note) { return note.status === 'sent' && note.authorId === userId; })
      .sort(function (a, b) { return b.sentAt - a.sentAt; });
  }

  function draftsOf(userId) {
    return liveNotes()
      .filter(function (note) { return note.status === 'draft' && note.authorId === userId; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  function unreadOf(userId) {
    return inboxOf(userId).filter(function (note) { return !note.openedAt; }).length;
  }

  function composeNote() {
    var note = noteById(state.composeNoteId);
    return note && !note.trashedAt ? note : null;
  }

  function icon(name) {
    return '<span class="icon icon--' + name + '" aria-hidden="true"></span>';
  }

  function greeting() {
    return 'Welcome back, ' + currentUser().name;
  }

  function nextVisitDays() {
    var target = new Date(D.nextVisit + 'T00:00:00').getTime();
    var days = Math.ceil((target - Date.now()) / 86400000);
    return days > 0 ? days : 0;
  }

  // ---------------------------------------------------------------- chrome

  function roombarHtml() {
    var me = currentUser();
    var them = partnerOf(me.id);
    var days = nextVisitDays();
    return (
      '<header class="roombar">' +
        '<button class="roombar__brand" type="button" data-act="home">' +
          icon('home') +
          '<span class="roombar__title hand">our little room</span>' +
        '</button>' +
        '<div class="roombar__right">' +
          '<button class="countdown" type="button" data-act="calendar" title="Our calendar">' +
            '<span class="countdown__num">' + days + '</span>' +
            '<span class="countdown__txt">' + (days === 1 ? 'day' : 'days') + ' until together</span>' +
          '</button>' +
          '<span class="people" aria-label="Signed in as ' + esc(me.name) + ' with ' + esc(them.name) + '">' +
            '<span class="avatar avatar--a is-me">' + esc(initials(me.name)) + '</span>' +
            '<span class="avatar avatar--b">' + esc(initials(them.name)) + '</span>' +
          '</span>' +
        '</div>' +
      '</header>'
    );
  }

  function dockHtml() {
    var me = currentUser();
    return (
      '<span class="mockdock__tag">Mock</span>' +
      '<span class="mockdock__group">' +
        '<span class="mockdock__label">view as</span>' +
        D.users
          .map(function (user) {
            return (
              '<button class="mockpill' + (user.id === me.id ? ' is-on' : '') + '" type="button" ' +
              'data-act="viewer" data-id="' + user.id + '">' + esc(user.name) + '</button>'
            );
          })
          .join('') +
      '</span>' +
      '<span class="mockdock__group">' +
        '<button class="mockpill" type="button" data-act="home">Home</button>' +
        '<button class="mockpill" type="button" data-act="notes">Notes</button>' +
        '<button class="mockpill" type="button" data-act="compose-new">New letter</button>' +
      '</span>' +
      '<button class="mockpill" type="button" data-act="show-email">Last email</button>' +
      '<button class="mockpill mockpill--quiet" type="button" data-act="reset">Reset</button>'
    );
  }

  // ---------------------------------------------------------------- home

  function homeHtml() {
    var me = currentUser();
    var unread = unreadOf(me.id);
    var days = nextVisitDays();
    return (
      '<section class="home">' +
        '<p class="tag">a little home just for two</p>' +
        '<div class="home__heading">' +
          '<h1 class="home__greeting">' + esc(greeting()) + '</h1>' +
          '<p class="home__tagline">what shall we remember today?</p>' +
        '</div>' +
        '<div class="shelf">' +
          '<button class="hero-book" type="button" data-act="scrapbooks">' +
            '<span class="hero-book__tape" aria-hidden="true"></span>' +
            '<span class="hero-book__label">' +
              '<img class="hero-book__heart" src="assets/svg/doodle-heart.svg" alt="">' +
              '<h2>Scrapbooks</h2>' +
              '<p>our memories, tucked in safe</p>' +
            '</span>' +
            '<img class="hero-book__flower" src="assets/svg/pressed-flower.svg" alt="" aria-hidden="true">' +
          '</button>' +
          '<button class="hero-book hero-book--notes" type="button" data-act="notes">' +
            '<span class="hero-book__tape" aria-hidden="true"></span>' +
            '<span class="hero-book__label">' +
              '<h2>Notes</h2>' +
              '<p>letters for the two of us</p>' +
            '</span>' +
            '<img class="hero-book__paper" src="assets/svg/lined-paper.svg" alt="" aria-hidden="true">' +
            (unread
              ? '<span class="hero-notes__badge">' + unread + ' unread</span>'
              : '') +
          '</button>' +
        '</div>' +
        '<button class="together-link" type="button" data-act="calendar">' +
          '<span class="together-link__heart" aria-hidden="true">♡</span>' +
          '<span>' + (days === 0 ? "we're together right now" : days + ' days until we&#39;re together') + '</span>' +
        '</button>' +
      '</section>'
    );
  }

  // ---------------------------------------------------------------- notes

  function envelopeHtml(note, big) {
    var author = userById(note.authorId);
    var recipient = userById(note.recipientId);
    var stamp = stampById(note.envelope.stamp);
    return (
      '<span class="env' + (big ? ' env--big' : '') + '" style="--env:' + esc(note.envelope.tint) + ';--seal:' + esc(note.envelope.seal) + '">' +
        '<span class="env__body">' +
          '<span class="env__stamp"><img src="' + stamp.art + '" alt=""></span>' +
          '<span class="env__address">' +
            '<span class="env__to">To ' + esc(recipient.name) + '</span>' +
            '<span class="env__from">from ' + esc(author.name) + '</span>' +
          '</span>' +
          '<span class="env__fold env__fold--left"></span>' +
          '<span class="env__fold env__fold--right"></span>' +
        '</span>' +
        '<span class="env__flap"></span>' +
        '<span class="env__seal">' + esc(note.envelope.initial || initials(author.name)) + '</span>' +
      '</span>'
    );
  }

  function statusChip(note) {
    var me = currentUser();
    if (note.status === 'draft') return '<span class="chip chip--draft">Draft</span>';
    if (note.authorId === me.id) {
      return note.openedAt
        ? '<span class="chip chip--opened">Opened</span>'
        : '<span class="chip chip--sealed">Sealed</span>';
    }
    return note.openedAt
      ? '<span class="chip chip--opened">Read</span>'
      : '<span class="chip chip--sealed">Unread</span>';
  }

  function cardMeta(note) {
    var me = currentUser();
    if (note.status === 'draft') {
      return 'Edited ' + timeAgo(note.updatedAt);
    }
    if (note.authorId === me.id) {
      var to = userById(note.recipientId).name;
      if (note.openedAt) return 'To ' + to + ' · opened ' + timeAgo(note.openedAt);
      return 'To ' + to + ' · waiting to be opened';
    }
    var from = userById(note.authorId).name;
    if (!note.openedAt) return 'From ' + from + ' · sealed';
    return 'From ' + from + ' · ' + timeAgo(note.sentAt);
  }

  function cardPreview(note) {
    var me = currentUser();
    var sealed = note.status === 'sent' && note.recipientId === me.id && !note.openedAt;
    if (sealed) return '<span class="note-card__sealed">A sealed letter. Break the seal to read it.</span>';
    return '<span class="note-card__preview">' + esc(preview(note.bodyHtml, 96)) + '</span>';
  }

  function noteCard(note) {
    var me = currentUser();
    var draft = note.status === 'draft';
    var sealed = note.status === 'sent' && note.recipientId === me.id && !note.openedAt;
    var paper = paperById(note.paper);
    return (
      '<button class="note-card' + (draft ? ' note-card--draft' : '') + (sealed ? ' note-card--sealed' : '') + '" ' +
        'type="button" data-act="open-note" data-id="' + note.id + '">' +
        (draft
          ? '<span class="note-card__paper" style="--paper:' + esc(note.paperColor || paper.color) + ';--ink:#4a3b2e">' +
              '<span class="note-card__paper-head">' +
                '<span class="hand">' + esc(preview(note.bodyHtml, 18) || 'Untitled letter') + '</span>' +
              '</span>' +
              '<span class="note-card__paper-lines" aria-hidden="true"></span>' +
            '</span>'
          : '<span class="note-card__env">' + envelopeHtml(note, false) + '</span>') +
        '<span class="note-card__body' + (draft ? ' note-card__body--draft' : '') + '">' +
          (draft
            ? '<span class="note-card__meta">' + esc(cardMeta(note)) + ' · ' + esc(dayLabel(note.updatedAt)) + '</span>'
            : '<span class="note-card__top">' +
                '<span class="note-card__who">' +
                  (note.authorId === me.id ? 'You wrote' : 'From ' + esc(userById(note.authorId).name)) +
                '</span>' +
                statusChip(note) +
              '</span>' +
              cardPreview(note) +
              '<span class="note-card__meta">' + esc(cardMeta(note)) + ' · ' + esc(dayLabel(note.sentAt)) + '</span>') +
        '</span>' +
      '</button>'
    );
  }

  function emptyHtml(tab) {
    if (tab === 'drafts') {
      return (
        '<div class="empty">' +
          '<img src="assets/svg/doodle-heart.svg" alt="" aria-hidden="true">' +
          '<h3>No drafts on the go</h3>' +
          '<p>Start a letter and save it here until it feels right.</p>' +
          '<button class="btn btn--primary" type="button" data-act="compose-new">' + icon('plus') + 'New letter</button>' +
        '</div>'
      );
    }
    if (tab === 'outbox') {
      return (
        '<div class="empty">' +
          '<img src="assets/svg/postcard.svg" alt="" aria-hidden="true">' +
          '<h3>Nothing sent yet</h3>' +
          '<p>Letters you seal will wait here, with a little note when they are opened.</p>' +
        '</div>'
      );
    }
    return (
      '<div class="empty">' +
        '<img src="assets/svg/postcard.svg" alt="" aria-hidden="true">' +
        '<h3>No letters waiting</h3>' +
        '<p>When your person writes, their envelope will appear here.</p>' +
      '</div>'
    );
  }

  function notesHtml() {
    var me = currentUser();
    var lists = {
      inbox: inboxOf(me.id),
      outbox: outboxOf(me.id),
      drafts: draftsOf(me.id),
    };
    var unread = unreadOf(me.id);
    var list = lists[state.tab] || lists.inbox;
    var titles = { inbox: 'Letters', outbox: 'Outbox', drafts: 'Drafts' };
    return (
      '<section class="notes">' +
        '<div class="notes__head">' +
          '<div class="notes__heading">' +
            '<p class="tag tag--tape">our notes</p>' +
            '<h1 class="notes__title">' + (titles[state.tab] || 'Letters') + '</h1>' +
            '<p class="notes__sub">' +
              (state.tab === 'inbox'
                ? 'the letters ' + esc(partnerOf(me.id).name) + ' has sealed for you'
                : state.tab === 'outbox'
                  ? 'letters you have sent into the world'
                  : 'letters still being written') +
            '</p>' +
          '</div>' +
          '<button class="btn btn--primary" type="button" data-act="compose-new">' + icon('plus') + 'New letter</button>' +
        '</div>' +
        '<div class="tabs" role="tablist" aria-label="Note lists">' +
          '<button class="tab' + (state.tab === 'inbox' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (state.tab === 'inbox') + '" data-act="tab" data-tab="inbox">Letters' +
            (unread ? '<span class="tab__count">' + unread + '</span>' : '') +
          '</button>' +
          '<button class="tab' + (state.tab === 'outbox' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (state.tab === 'outbox') + '" data-act="tab" data-tab="outbox">Outbox' +
            (lists.outbox.length ? '<span class="tab__count">' + lists.outbox.length + '</span>' : '') +
          '</button>' +
          '<button class="tab' + (state.tab === 'drafts' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (state.tab === 'drafts') + '" data-act="tab" data-tab="drafts">Drafts' +
            (lists.drafts.length ? '<span class="tab__count">' + lists.drafts.length + '</span>' : '') +
          '</button>' +
        '</div>' +
        '<div class="note-grid">' +
          (list.length ? list.map(noteCard).join('') : emptyHtml(state.tab)) +
        '</div>' +
      '</section>'
    );
  }

  // ---------------------------------------------------------------- compose

  function letterHtml(note, editable) {
    var paper = paperById(note.paper);
    var classes = ['letter', 'paper--' + note.paper];
    if (paper.sheen) classes.push('letter--sheen');
    var contentId = editable ? 'letterEditor' : 'readLetterContent';
    var spillId = editable ? 'letterSpill' : 'readLetterSpill';
    return (
      '<div class="letter-frame">' +
        '<div class="' + classes.join(' ') + '" style="--paper:' + esc(note.paperColor || paper.color) + '">' +
          '<div class="letter__content" ' +
            (editable ? 'contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" aria-label="Letter text" ' : '') +
            'id="' + contentId + '">' + (note.bodyHtml || '') + '</div>' +
          '<div class="letter__content letter__spill" id="' + spillId + '" aria-hidden="true"></div>' +
          (editable ? '<div class="letter__grip" id="letterGrip" title="Drag to make the page taller or shorter" aria-hidden="true"></div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function fontSizeValue(select) {
    return select.value;
  }

  function panelLetterHtml(note) {
    var paper = paperById(note.paper);
    var palette = paper.palette || [];
    return (
      '<section class="panel__section">' +
        '<div class="panel__section-head"><h2>Paper</h2><span class="panel__hint">one page, your height</span></div>' +
        '<div class="paper-grid" role="group" aria-label="Letter paper">' +
          D.papers.map(function (item) {
            var selected = item.id === note.paper;
            return (
              '<button class="paper-swatch' + (selected ? ' is-on' : '') + '" type="button" data-act="paper" data-id="' + item.id + '" ' +
                'title="' + esc(item.label) + '" aria-label="' + esc(item.label) + '" aria-pressed="' + selected + '">' +
                '<span class="paper-swatch__sheet rules--' + (item.lines || 'plain') + (item.margin ? ' rules--margin' : '') + (item.sheen ? ' paper-swatch__sheet--sheen' : '') + '" style="--sw:' + esc(item.color) + '"></span>' +
              '</button>'
            );
          }).join('') +
        '</div>' +
        (palette.length
          ? '<div class="swatch-row" role="group" aria-label="Paper colour">' +
              '<span class="swatch-row__label">Tint</span>' +
              palette.map(function (color) {
                var on = (note.paperColor || paper.color) === color;
                return '<button class="swatch' + (on ? ' is-on' : '') + '" type="button" data-act="paper-color" data-color="' + color + '" style="--sw:' + color + '" aria-label="Paper colour ' + color + '" aria-pressed="' + on + '"></button>';
              }).join('') +
            '</div>'
          : '') +
      '</section>' +
      '<section class="panel__section">' +
        '<div class="panel__section-head"><h2>Writing</h2><span class="panel__hint">select words to restyle</span></div>' +
        '<div class="fields">' +
          '<label class="field"><span>Font</span><select id="fontSelect">' +
            D.fonts.map(function (font) { return '<option value="' + esc(font.family) + '">' + esc(font.label) + '</option>'; }).join('') +
          '</select></label>' +
          '<label class="field field--size"><span>Size</span><select id="sizeSelect">' +
            D.sizes.map(function (size) { return '<option value="' + size + '"' + (size === 20 ? ' selected' : '') + '>' + size + '</option>'; }).join('') +
          '</select></label>' +
        '</div>' +
        '<div class="toolrow">' +
          '<button class="tool" type="button" data-cmd="bold" title="Bold" aria-label="Bold" aria-pressed="false"><b>B</b></button>' +
          '<button class="tool" type="button" data-cmd="italic" title="Italic" aria-label="Italic" aria-pressed="false"><i>I</i></button>' +
          '<button class="tool" type="button" data-cmd="underline" title="Underline" aria-label="Underline" aria-pressed="false"><u>U</u></button>' +
          '<button class="tool" type="button" data-cmd="strikeThrough" title="Strikethrough" aria-label="Strikethrough" aria-pressed="false"><s>S</s></button>' +
          '<span class="toolrow__sep" aria-hidden="true"></span>' +
          '<button class="tool tool--align" type="button" data-align="left" title="Align left" aria-label="Align left"><span class="alignicon alignicon--left" aria-hidden="true"><i></i><i></i><i></i></span></button>' +
          '<button class="tool tool--align" type="button" data-align="center" title="Align centre" aria-label="Align centre"><span class="alignicon alignicon--center" aria-hidden="true"><i></i><i></i><i></i></span></button>' +
          '<button class="tool tool--align" type="button" data-align="right" title="Align right" aria-label="Align right"><span class="alignicon alignicon--right" aria-hidden="true"><i></i><i></i><i></i></span></button>' +
        '</div>' +
        '<div class="swatch-row">' +
          '<span class="swatch-row__label">Ink</span>' +
          D.inks.map(function (color) {
            return '<button class="swatch swatch--ink" type="button" data-ink="' + color + '" style="--sw:' + color + '" aria-label="Ink ' + color + '"></button>';
          }).join('') +
        '</div>' +
        '<div class="swatch-row">' +
          '<span class="swatch-row__label">Highlight</span>' +
          D.highlights.map(function (color) {
            return '<button class="swatch swatch--hl" type="button" data-hl="' + color + '" style="--sw:' + color + '" aria-label="Highlight ' + color + '"></button>';
          }).join('') +
          '<button class="swatch swatch--none" type="button" data-hl="none" aria-label="No highlight">✕</button>' +
        '</div>' +
      '</section>' +
      '<section class="panel__section">' +
        '<div class="panel__section-head"><h2>Page</h2><span class="panel__hint">drag the bottom edge</span></div>' +
        '<p class="height-value" id="heightValue">' + note.pageHeight + ' px tall</p>' +
        '<p class="meter" id="pageMeter">Fits neatly on the page.</p>' +
        '<p class="hint">A fixed width keeps every letter the same column. Drag the bottom edge of the paper to lengthen or shorten it. Words past the page show in red, floating below it.</p>' +
      '</section>'
    );
  }

  function panelEnvelopeHtml(note) {
    var env = note.envelope;
    return (
      '<section class="panel__section">' +
        '<div class="panel__section-head"><h2>Envelope</h2><span class="panel__hint">the first thing they see</span></div>' +
        '<div class="swatch-row swatch-row--wrap" role="group" aria-label="Envelope tint">' +
          D.envelopeTints.map(function (tint) {
            var on = env.tint === tint.color;
            return '<button class="swatch swatch--big' + (on ? ' is-on' : '') + '" type="button" data-act="env-tint" data-color="' + tint.color + '" style="--sw:' + tint.color + '" title="' + esc(tint.label) + '" aria-label="' + esc(tint.label) + ' envelope" aria-pressed="' + on + '"></button>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<section class="panel__section">' +
        '<div class="panel__section-head"><h2>Wax seal</h2></div>' +
        '<div class="swatch-row" role="group" aria-label="Seal colour">' +
          D.sealColors.map(function (seal) {
            var on = env.seal === seal.color;
            return '<button class="swatch' + (on ? ' is-on' : '') + '" type="button" data-act="env-seal" data-color="' + seal.color + '" style="--sw:' + seal.color + '" title="' + esc(seal.label) + '" aria-label="' + esc(seal.label) + ' seal" aria-pressed="' + on + '"></button>';
          }).join('') +
        '</div>' +
        '<label class="field field--initial"><span>Initial</span>' +
          '<input id="sealInitial" type="text" maxlength="1" value="' + esc(env.initial || initials(currentUser().name)) + '" aria-label="Wax seal initial">' +
        '</label>' +
      '</section>' +
      '<section class="panel__section">' +
        '<div class="panel__section-head"><h2>Stamp</h2></div>' +
        '<div class="stamp-row" role="group" aria-label="Stamp">' +
          D.stamps.map(function (stamp) {
            var on = env.stamp === stamp.id;
            return '<button class="stamp' + (on ? ' is-on' : '') + '" type="button" data-act="env-stamp" data-id="' + stamp.id + '" aria-label="' + esc(stamp.label) + ' stamp" aria-pressed="' + on + '">' +
              '<img src="' + stamp.art + '" alt="">' +
            '</button>';
          }).join('') +
        '</div>' +
        '<p class="hint">Address lines and the postmark are drawn by the app; you choose the paper, seal and stamp.</p>' +
      '</section>'
    );
  }

  function composeStageHtml(note) {
    if (state.composeTab === 'envelope') {
      return (
        '<div class="env-stage">' +
          '<div class="env-stage__frame">' + envelopeHtml(note, true) + '</div>' +
          '<p class="env-stage__caption">The front of the envelope.</p>' +
        '</div>'
      );
    }
    return letterHtml(note, true);
  }

  function composeHtml() {
    var note = composeNote();
    if (!note) return notesHtml();
    var me = currentUser();
    var them = userById(note.recipientId);
    var sent = note.status === 'sent';
    var locked = sent && note.openedAt;
    return (
      '<section class="compose' + (state.panelOpen ? ' compose--panel-open' : '') + '">' +
        '<div class="compose__bar">' +
          '<button class="backlink" type="button" data-act="close-compose">' + icon('back') + 'All notes</button>' +
          '<div class="compose__who">' +
            '<span>To <strong>' + esc(them.name) + '</strong></span>' +
            '<span class="compose__from hand">from ' + esc(me.name) + '</span>' +
            (sent ? '<span class="chip chip--sealed">Sent' + (note.openedAt ? ' · opened' : ' · unopened') + '</span>' : '<span class="chip chip--draft">Draft</span>') +
          '</div>' +
          '<div class="segmented" role="tablist" aria-label="Compose mode">' +
            '<button class="segmented__btn' + (state.composeTab === 'letter' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (state.composeTab === 'letter') + '" data-act="compose-tab" data-tab="letter">Letter</button>' +
            '<button class="segmented__btn' + (state.composeTab === 'envelope' ? ' is-on' : '') + '" type="button" role="tab" aria-selected="' + (state.composeTab === 'envelope') + '" data-act="compose-tab" data-tab="envelope">Envelope</button>' +
          '</div>' +
          '<div class="compose__actions">' +
            '<button class="btn btn--small btn--ghost compose__save" type="button" data-act="save-draft">Save draft</button>' +
            (sent
              ? '<button class="btn btn--primary btn--small" type="button" data-act="save-changes">Save changes</button>'
              : '<button class="btn btn--primary btn--small" type="button" data-act="send-open">Seal &amp; send</button>') +
            '<button class="btn btn--small btn--ghost compose__style" type="button" data-act="toggle-panel">Style</button>' +
          '</div>' +
        '</div>' +
        '<div class="compose__body">' +
          '<div class="compose__stage' + (state.composeTab === 'envelope' ? ' compose__stage--envelope' : '') + '" id="composeStage" style="--page-w:' + PAGE_WIDTH + ';--page-h:' + note.pageHeight + ';--scale:1">' +
            composeStageHtml(note) +
          '</div>' +
          '<aside class="panel" aria-label="Letter settings">' +
            '<div class="panel__sheet">' +
              '<span class="panel__sheet-grip" aria-hidden="true"></span>' +
              '<span class="panel__sheet-title">' + (state.composeTab === 'letter' ? 'Paper &amp; pen' : 'Envelope') + '</span>' +
              '<button class="btn btn--small" type="button" data-act="toggle-panel">Done</button>' +
            '</div>' +
            (state.composeTab === 'letter' ? panelLetterHtml(note) : panelEnvelopeHtml(note)) +
            (locked ? '<p class="panel__locked">' + esc(them.name) + ' has opened this letter, so it is locked. Copy anything you want to change into a new letter.</p>' : '') +
          '</aside>' +
        '</div>' +
      '</section>'
    );
  }

  function dialogHtml() {
    var note = composeNote();
    if (!note) return '';
    var them = userById(note.recipientId);
    var over = overflowFor(note);
    return (
      '<div class="scrim" data-act="send-cancel">' +
        '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="sendTitle" data-stop="1">' +
          '<p class="dialog__eyebrow hand">ready to seal it</p>' +
          '<h2 id="sendTitle">Send this letter to ' + esc(them.name) + '?</h2>' +
          '<div class="dialog__env">' + envelopeHtml(note, false) + '</div>' +
          '<p class="dialog__copy">' + esc(them.name) + ' will get a little email, and the letter will wait in their inbox until they break the seal.</p>' +
          (over > 0
            ? '<p class="dialog__warn">The letter runs about ' + linesPast(over) + ' past the page. Those words will be in red below the paper.</p>'
            : '<p class="dialog__ok">The letter fits its page.</p>') +
          '<p class="dialog__hint">You can still edit or pull it back until ' + esc(them.name) + ' opens it.</p>' +
          '<div class="dialog__actions">' +
            '<button class="btn btn--ghost" type="button" data-act="send-cancel">Keep writing</button>' +
            '<button class="btn btn--primary" type="button" data-act="send-confirm">Seal &amp; send</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------- read

  function readHtml() {
    var note = noteById(state.noteId);
    if (!note || note.trashedAt) return notesHtml();
    var me = currentUser();
    var author = userById(note.authorId);
    var them = userById(note.recipientId);
    if (note.status === 'draft' && note.authorId !== me.id) return notesHtml();
    if (note.status === 'draft') {
      state.screen = 'compose';
      state.composeNoteId = note.id;
      return composeHtml();
    }
    var isRecipient = note.recipientId === me.id;
    var sealed = isRecipient && !note.openedAt;
    var canChange = note.authorId === me.id && !note.openedAt;
    var head =
      '<div class="read__bar">' +
        '<button class="backlink" type="button" data-act="notes">' + icon('back') + 'All notes</button>' +
        '<div class="read__meta">' +
          '<span class="read__from">' + (note.authorId === me.id ? 'To ' + esc(them.name) : 'From ' + esc(author.name)) + '</span>' +
          '<span class="read__dot" aria-hidden="true">·</span>' +
          '<span>' + esc(timeAgo(note.sentAt)) + '</span>' +
          (note.openedAt
            ? '<span class="chip chip--opened">Opened ' + esc(timeAgo(note.openedAt)) + '</span>'
            : '<span class="chip chip--sealed">Sealed</span>') +
        '</div>' +
        '<div class="read__actions">' +
          (canChange
            ? '<button class="btn btn--small" type="button" data-act="edit-note">' + icon('pencil') + 'Edit</button>' +
              '<button class="btn btn--small btn--ghost" type="button" data-act="unsend-note">Pull back</button>'
            : '') +
          (note.authorId === me.id
            ? '<button class="btn btn--small btn--ghost" type="button" data-act="trash-note">' + icon('trash') + 'Trash</button>'
            : '') +
        '</div>' +
      '</div>';
    if (sealed) {
      return (
        '<section class="read read--sealed">' + head +
          '<div class="sealed" id="sealedEnv">' +
            '<div class="sealed__stage" id="sealedStage" style="--page-w:' + PAGE_WIDTH + ';--page-h:' + note.pageHeight + ';--scale:1" aria-hidden="true">' +
              letterHtml(note, false) +
            '</div>' +
            '<p class="read__note sealed__spacer" aria-hidden="true">Sealed with love.</p>' +
            '<div class="sealed__overlay">' +
              '<div class="sealed__envelope">' + envelopeHtml(note, true) + '</div>' +
              '<div class="sealed__controls">' +
                '<p class="sealed__line">A letter for ' + esc(them.name) + ', from ' + esc(author.name) + ' · ' + esc(timeAgo(note.sentAt)) + '</p>' +
                '<button class="btn btn--primary sealed__button" type="button" data-act="break-seal">Break the seal</button>' +
                '<p class="sealed__hint">' + esc(author.name) + ' will see that you have opened it.</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>'
      );
    }
    return (
      '<section class="read">' + head +
        '<div class="read__stage" id="readStage" style="--page-w:' + PAGE_WIDTH + ';--page-h:' + note.pageHeight + ';--scale:1">' +
          letterHtml(note, false) +
        '</div>' +
        '<p class="read__note" id="readNote">' + (note.authorId === me.id ? (note.openedAt ? esc(them.name) + ' opened this ' + esc(timeAgo(note.openedAt)) + '.' : 'Still sealed — ' + esc(them.name) + ' has not opened it yet.') : 'Sealed with love.') + '</p>' +
        '<p class="read__warn" id="readWarn" hidden>This letter runs past its page. The extra words are in red below the paper.</p>' +
      '</section>'
    );
  }

  // ---------------------------------------------------------------- email

  function emailHtml() {
    var email = state.email;
    if (!email) return '';
    return (
      '<aside class="emailcard" role="dialog" aria-label="Mock email">' +
        '<div class="emailcard__head">' +
          '<span class="emailcard__tag">Mock email</span>' +
          '<button class="emailcard__close" type="button" data-act="close-email" aria-label="Close email preview">×</button>' +
        '</div>' +
        '<p class="emailcard__row"><span>To</span>' + esc(email.to) + '</p>' +
        '<p class="emailcard__subject">' + esc(email.subject) + '</p>' +
        '<p class="emailcard__body">' + esc(email.body) + '</p>' +
        '<p class="emailcard__link">' + esc(email.link) + '</p>' +
        '<p class="emailcard__foot">Nothing is really sent in this mockup.</p>' +
      '</aside>'
    );
  }

  // ---------------------------------------------------------------- render

  function render() {
    save();
    var me = currentUser();
    if (state.screen === 'compose') {
      var note = composeNote();
      if (!note || note.authorId !== me.id) {
        state.screen = 'notes';
        state.composeNoteId = null;
      }
    }
    if (state.screen === 'read') {
      var readNote = noteById(state.noteId);
      if (!readNote || readNote.trashedAt) state.screen = 'notes';
    }
    byId('roombar').innerHTML = roombarHtml();
    var view = byId('view');
    if (state.screen === 'home') view.innerHTML = homeHtml();
    else if (state.screen === 'notes') view.innerHTML = notesHtml();
    else if (state.screen === 'compose') view.innerHTML = composeHtml();
    else if (state.screen === 'read') view.innerHTML = readHtml();
    byId('dock').innerHTML = dockHtml();
    byId('emailMount').innerHTML = state.emailOpen ? emailHtml() : '';
    byId('dialogMount').innerHTML = state.confirmSend ? dialogHtml() : '';
    document.body.classList.toggle('is-fixed-view', state.screen === 'compose' || state.screen === 'read');
    if (state.screen === 'compose') initCompose();
    if (state.screen === 'read') initRead();
    save();
  }

  // ---------------------------------------------------------------- compose behaviour

  function setStageVars(stage, note) {
    stage.style.setProperty('--page-w', String(PAGE_WIDTH));
    stage.style.setProperty('--page-h', String(note.pageHeight));
  }

  function fitStage(stage, pageHeight) {
    if (!stage) return;
    var styles = window.getComputedStyle(stage);
    var padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    var padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    var width = stage.clientWidth - padX - 8;
    var height = stage.clientHeight - padY - 8;
    var scale = Math.min(width / PAGE_WIDTH, height / pageHeight, 1);
    scale = clamp(scale, 0.3, 1);
    stage.style.setProperty('--scale', String(Math.round(scale * 1000) / 1000));
  }

  function observeStage(stage, getPageHeight) {
    if (!stage || typeof ResizeObserver === 'undefined') return;
    try {
      var observer = new ResizeObserver(function () {
        fitStage(stage, getPageHeight());
      });
      observer.observe(stage);
    } catch (error) {
      /* layout observation is a nicety; the stage still fits on load */
    }
  }

  function linesPast(overflow) {
    var lines = Math.max(1, Math.round(overflow / RULE));
    return lines + (lines === 1 ? ' line' : ' lines');
  }

  function overflowFor(note) {
    var editor = byId('letterEditor') || byId('readLetterContent');
    if (!editor) return 0;
    return Math.max(0, editor.scrollHeight - note.pageHeight);
  }

  function updateOverflow(note) {
    var editor = byId('letterEditor') || byId('readLetterContent');
    var spill = byId('letterSpill') || byId('readLetterSpill');
    if (!editor || !spill) return;
    spill.innerHTML = editor.innerHTML;
    var fullHeight = Math.max(editor.scrollHeight, note.pageHeight);
    spill.style.height = fullHeight + 'px';
    spill.style.clipPath = 'inset(' + note.pageHeight + 'px 0 0 0)';
    spill.style.webkitClipPath = 'inset(' + note.pageHeight + 'px 0 0 0)';
    var over = Math.max(0, editor.scrollHeight - note.pageHeight);
    var meter = byId('pageMeter');
    if (meter) {
      meter.classList.toggle('meter--over', over > 0);
      meter.textContent = over > 0
        ? 'Runs about ' + linesPast(over) + ' past the page. Those words are red.'
        : 'Fits neatly on the page.';
    }
  }

  function updateHeightUi(note) {
    var value = byId('heightValue');
    if (value) value.textContent = note.pageHeight + ' px tall';
    byId('composeStage').style.setProperty('--page-h', String(note.pageHeight));
  }

  function syncToolbar() {
    ['bold', 'italic', 'underline', 'strikeThrough'].forEach(function (cmd) {
      var buttons = document.querySelectorAll('[data-cmd="' + cmd + '"]');
      var on = false;
      try {
        on = document.queryCommandState(cmd);
      } catch (error) {
        on = false;
      }
      buttons.forEach(function (button) {
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-pressed', String(on));
      });
    });
  }

  function saveCaret() {
    var editor = byId('letterEditor');
    if (!editor) return null;
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    var range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    var pre = document.createRange();
    pre.selectNodeContents(editor);
    pre.setEnd(range.startContainer, range.startOffset);
    var start = pre.toString().length;
    return { start: start, end: start + range.toString().length };
  }

  function restoreCaret(saved) {
    var editor = byId('letterEditor');
    if (!editor || !saved) return;
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    var node;
    var count = 0;
    var startNode = null;
    var startOffset = 0;
    var endNode = null;
    var endOffset = 0;
    while ((node = walker.nextNode())) {
      var next = count + node.nodeValue.length;
      if (!startNode && saved.start <= next) {
        startNode = node;
        startOffset = saved.start - count;
      }
      if (!endNode && saved.end <= next) {
        endNode = node;
        endOffset = saved.end - count;
      }
      count = next;
    }
    if (!startNode) return;
    var range = document.createRange();
    range.setStart(startNode, clamp(startOffset, 0, startNode.nodeValue.length));
    if (endNode) range.setEnd(endNode, clamp(endOffset, 0, endNode.nodeValue.length));
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    editor.focus();
  }

  function syncBody(note) {
    var editor = byId('letterEditor');
    if (!editor) return;
    note.bodyHtml = editor.innerHTML;
    note.updatedAt = Date.now();
    updateOverflow(note);
    save();
  }

  function wrapSelection(styles) {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      toast('Select some words first, then choose a style.');
      return;
    }
    var range = selection.getRangeAt(0);
    var editor = byId('letterEditor');
    if (!editor || !editor.contains(range.commonAncestorContainer)) return;
    var span = document.createElement('span');
    Object.keys(styles).forEach(function (key) {
      span.style[key] = styles[key];
    });
    try {
      range.surroundContents(span);
    } catch (error) {
      var fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    selection.removeAllRanges();
    var next = document.createRange();
    next.selectNodeContents(span);
    selection.addRange(next);
    var note = composeNote();
    if (note) syncBody(note);
  }

  function focusEditorEnd(editor) {
    if (!editor) return;
    editor.focus();
    var range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function applyCommand(command, value) {
    var editor = byId('letterEditor');
    if (!editor) return;
    editor.focus();
    try {
      document.execCommand(command, false, value);
    } catch (error) {
      /* older browsers can refuse a command; the mockup carries on */
    }
    var note = composeNote();
    if (note) syncBody(note);
    syncToolbar();
  }

  function changeFont(family) {
    wrapSelection({ fontFamily: family });
  }

  function changeSize(size) {
    wrapSelection({ fontSize: size + 'px' });
  }

  function initGrip(note, stage) {
    var grip = byId('letterGrip');
    if (!grip) return;
    var dragging = false;
    var startY = 0;
    var startHeight = 0;
    grip.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      dragging = true;
      startY = event.clientY;
      startHeight = note.pageHeight;
      try {
        grip.setPointerCapture(event.pointerId);
      } catch (error) {
        /* synthetic pointers and older browsers have no capture */
      }
      document.body.classList.add('is-resizing');
    });
    grip.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var scale = Number(getComputedStyle(stage).getPropertyValue('--scale')) || 1;
      var next = clamp(startHeight + (event.clientY - startY) / scale, MIN_HEIGHT, MAX_HEIGHT);
      note.pageHeight = Math.round(next / 10) * 10;
      updateHeightUi(note);
      fitStage(stage, note.pageHeight);
      updateOverflow(note);
      save();
    });
    function stop(event) {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('is-resizing');
      try {
        grip.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignore */
      }
    }
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
  }

  function initCompose() {
    var note = composeNote();
    if (!note) return;
    var stage = byId('composeStage');
    if (!stage) return;
    setStageVars(stage, note);
    observeStage(stage, function () {
      return note.pageHeight;
    });
    requestAnimationFrame(function () {
      fitStage(stage, note.pageHeight);
      updateOverflow(note);
      if (state.focusEditor) {
        state.focusEditor = false;
        focusEditorEnd(byId('letterEditor'));
      }
    });
    var editor = byId('letterEditor');
    if (editor) {
      try {
        document.execCommand('styleWithCSS', false, true);
      } catch (error) {
        /* ignore */
      }
      editor.addEventListener('input', function () {
        syncBody(note);
      });
      editor.addEventListener('keyup', syncToolbar);
      editor.addEventListener('mouseup', syncToolbar);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          updateOverflow(note);
        });
      }
    }
    var fontSelect = byId('fontSelect');
    if (fontSelect) {
      fontSelect.addEventListener('change', function () {
        changeFont(fontSelect.value);
      });
    }
    var sizeSelect = byId('sizeSelect');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', function () {
        changeSize(fontSizeValue(sizeSelect));
      });
    }
    var sealInitial = byId('sealInitial');
    if (sealInitial) {
      sealInitial.addEventListener('input', function () {
        note.envelope.initial = sealInitial.value.slice(0, 1).toUpperCase();
        var seals = document.querySelectorAll('.env--big .env__seal');
        seals.forEach(function (seal) {
          seal.textContent = note.envelope.initial || initials(currentUser().name);
        });
        note.updatedAt = Date.now();
        save();
      });
    }
    initGrip(note, stage);
  }

  function initRead() {
    var note = noteById(state.noteId);
    if (!note) return;
    var stage = byId('readStage') || byId('sealedStage');
    if (!stage) return;
    setStageVars(stage, note);
    observeStage(stage, function () {
      return note.pageHeight;
    });
    requestAnimationFrame(function () {
      fitStage(stage, note.pageHeight);
      updateOverflow(note);
      toggleReadWarning(note);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        updateOverflow(note);
        toggleReadWarning(note);
      });
    }
  }

  function toggleReadWarning(note) {
    var warn = byId('readWarn');
    var noteLine = byId('readNote');
    if (!warn || !noteLine) return;
    var over = overflowFor(note);
    warn.hidden = over <= 0;
    noteLine.hidden = over > 0;
  }

  // ---------------------------------------------------------------- actions

  function openNotes(tab) {
    state.screen = 'notes';
    state.confirmSend = false;
    state.emailOpen = false;
    if (tab) state.tab = tab;
    render();
  }

  function newDraft() {
    var me = currentUser();
    var them = partnerOf(me.id);
    var note = {
      id: 'n-' + Math.random().toString(36).slice(2, 8),
      authorId: me.id,
      recipientId: them.id,
      status: 'draft',
      paper: 'lined',
      paperColor: '#fdf8ef',
      pageHeight: 620,
      bodyHtml:
        "<p><span style='font-family:\"Caveat\",cursive;font-size:25px'>Dear " + esc(them.name) + ",</span></p><p><br></p>",
      envelope: {
        tint: '#d9b98c',
        seal: '#8a3b3b',
        initial: initials(me.name),
        stamp: 'fern',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sentAt: 0,
      openedAt: 0,
      trashedAt: 0,
    };
    state.notes.push(note);
    state.composeNoteId = note.id;
    state.composeTab = 'letter';
    state.screen = 'compose';
    state.focusEditor = true;
    render();
  }

  function sendNote(note) {
    if (!note || note.status !== 'draft') return;
    var author = userById(note.authorId);
    var them = userById(note.recipientId);
    note.status = 'sent';
    note.sentAt = Date.now();
    note.updatedAt = note.sentAt;
    note.openedAt = 0;
    state.email = {
      to: them.email || them.name.toLowerCase() + '@example.com',
      subject: 'A letter from ' + author.name,
      body:
        them.name + ', ' + author.name + ' sealed a letter for you. Open it in your little room:',
      link: 'https://haftels.com/journeybook/notes/' + note.id,
    };
    state.emailOpen = true;
    state.confirmSend = false;
    state.screen = 'notes';
    state.tab = 'outbox';
    state.composeNoteId = null;
    render();
    toast('Sealed and sent to ' + them.name + '.');
  }

  function breakSeal(note) {
    var sealed = byId('sealedEnv');
    if (sealed) sealed.classList.add('is-breaking');
    setTimeout(function () {
      if (currentUser().id === note.recipientId && !note.openedAt) {
        note.openedAt = Date.now();
        note.updatedAt = note.openedAt;
      }
      render();
    }, 1350);
  }

  function switchViewer(id) {
    if (state.viewerId === id) return;
    state.viewerId = id;
    state.confirmSend = false;
    state.emailOpen = false;
    var note = state.screen === 'compose' ? composeNote() : noteById(state.noteId);
    if (state.screen === 'compose' && (!note || note.authorId !== id)) {
      state.screen = 'notes';
      state.tab = 'drafts';
    }
    render();
    toast('Now viewing as ' + userById(id).name + '.');
  }

  function toast(text) {
    var host = byId('toasts');
    if (!host) return;
    var node = document.createElement('div');
    node.className = 'toast';
    node.textContent = text;
    host.appendChild(node);
    setTimeout(function () {
      node.classList.add('is-leaving');
      setTimeout(function () {
        node.remove();
      }, 260);
    }, 2800);
  }

  // ---------------------------------------------------------------- events

  function onClick(event) {
    var target = event.target.closest('[data-act]');
    if (!target) return;
    var act = target.getAttribute('data-act');
    var note = state.screen === 'compose' ? composeNote() : state.noteId ? noteById(state.noteId) : null;

    // Clicks inside the send dialog must not fall through to the scrim.
    if (event.target.closest('.dialog') && !event.target.closest('.dialog [data-act]')) return;

    if (act !== 'send-cancel') event.preventDefault();

    switch (act) {
      case 'home':
        state.screen = 'home';
        state.confirmSend = false;
        state.emailOpen = false;
        render();
        break;
      case 'notes':
        openNotes();
        break;
      case 'scrapbooks':
        toast('Scrapbooks are not part of this Notes mockup.');
        break;
      case 'calendar':
        toast('The calendar is not part of this Notes mockup.');
        break;
      case 'tab':
        state.tab = target.getAttribute('data-tab');
        render();
        break;
      case 'compose-new':
        newDraft();
        break;
      case 'open-note': {
        var opened = noteById(target.getAttribute('data-id'));
        if (!opened) break;
        if (opened.status === 'draft') {
          state.composeNoteId = opened.id;
          state.composeTab = 'letter';
          state.screen = 'compose';
          render();
        } else {
          state.noteId = opened.id;
          state.screen = 'read';
          render();
        }
        break;
      }
      case 'compose-tab':
        state.composeTab = target.getAttribute('data-tab');
        render();
        break;
      case 'toggle-panel': {
        state.panelOpen = !state.panelOpen;
        var composeEl = document.querySelector('.compose');
        if (composeEl) composeEl.classList.toggle('compose--panel-open', state.panelOpen);
        save();
        break;
      }
      case 'paper': {
        var paper = paperById(target.getAttribute('data-id'));
        if (!note) break;
        note.paper = paper.id;
        note.paperColor = paper.color;
        note.updatedAt = Date.now();
        render();
        break;
      }
      case 'paper-color':
        if (!note) break;
        note.paperColor = target.getAttribute('data-color');
        note.updatedAt = Date.now();
        render();
        break;
      case 'env-tint':
        if (!note) break;
        note.envelope.tint = target.getAttribute('data-color');
        note.updatedAt = Date.now();
        render();
        break;
      case 'env-seal':
        if (!note) break;
        note.envelope.seal = target.getAttribute('data-color');
        note.updatedAt = Date.now();
        render();
        break;
      case 'env-stamp':
        if (!note) break;
        note.envelope.stamp = target.getAttribute('data-id');
        note.updatedAt = Date.now();
        render();
        break;
      case 'save-draft':
        if (!note) break;
        note.updatedAt = Date.now();
        openNotes('drafts');
        toast('Saved in drafts.');
        break;
      case 'send-open':
        if (!note) break;
        state.confirmSend = true;
        render();
        break;
      case 'send-confirm':
        if (!note) break;
        sendNote(note);
        break;
      case 'send-cancel':
        state.confirmSend = false;
        render();
        break;
      case 'save-changes':
        if (!note) break;
        note.updatedAt = Date.now();
        openNotes('outbox');
        toast('Saved. It stays editable until they open it.');
        break;
      case 'edit-note':
        if (!note || note.authorId !== currentUser().id || note.openedAt) break;
        state.composeNoteId = note.id;
        state.composeTab = 'letter';
        state.screen = 'compose';
        render();
        break;
      case 'unsend-note':
        if (!note || note.authorId !== currentUser().id || note.openedAt) break;
        note.status = 'draft';
        note.sentAt = 0;
        note.openedAt = 0;
        note.updatedAt = Date.now();
        state.composeNoteId = note.id;
        state.composeTab = 'letter';
        state.screen = 'compose';
        render();
        toast('Pulled back into drafts.');
        break;
      case 'trash-note':
        if (!note || note.authorId !== currentUser().id) break;
        note.trashedAt = Date.now();
        state.screen = 'notes';
        state.noteId = null;
        state.tab = note.status === 'draft' ? 'drafts' : 'outbox';
        render();
        toast('Letter moved to trash.');
        break;
      case 'break-seal': {
        var next = noteById(state.noteId);
        if (next) breakSeal(next);
        break;
      }
      case 'close-compose': {
        var current = composeNote();
        var wasSent = current && current.status === 'sent';
        openNotes(wasSent ? 'outbox' : 'drafts');
        if (current && !wasSent) toast('Draft saved.');
        break;
      }
      case 'viewer':
        switchViewer(target.getAttribute('data-id'));
        break;
      case 'show-email':
        if (!state.email) {
          toast('No email yet — seal a letter first.');
          break;
        }
        state.emailOpen = true;
        render();
        break;
      case 'close-email':
        state.emailOpen = false;
        render();
        break;
      case 'reset':
        reset();
        break;
      default:
        break;
    }
  }

  function onFormatClick(event) {
    var commandButton = event.target.closest('[data-cmd]');
    if (commandButton) {
      event.preventDefault();
      applyCommand(commandButton.getAttribute('data-cmd'));
      return;
    }
    var alignButton = event.target.closest('[data-align]');
    if (alignButton) {
      event.preventDefault();
      var align = alignButton.getAttribute('data-align');
      applyCommand(align === 'left' ? 'justifyLeft' : align === 'center' ? 'justifyCenter' : 'justifyRight');
      return;
    }
    var inkButton = event.target.closest('[data-ink]');
    if (inkButton) {
      event.preventDefault();
      applyCommand('foreColor', inkButton.getAttribute('data-ink'));
      markRow(inkButton, '.swatch--ink');
      return;
    }
    var highlightButton = event.target.closest('[data-hl]');
    if (highlightButton) {
      event.preventDefault();
      var value = highlightButton.getAttribute('data-hl');
      applyCommand('hiliteColor', value === 'none' ? 'transparent' : value);
      markRow(highlightButton, '.swatch--hl, .swatch--none');
    }
  }

  function markRow(button, selector) {
    var row = button.closest('.swatch-row');
    if (!row) return;
    row.querySelectorAll(selector).forEach(function (item) {
      item.classList.toggle('is-on', item === button);
    });
  }

  function onKeydown(event) {
    if (event.key !== 'Escape') return;
    if (state.confirmSend) {
      state.confirmSend = false;
      render();
      return;
    }
    if (state.emailOpen) {
      state.emailOpen = false;
      render();
      return;
    }
    if (state.screen === 'compose') {
      var note = composeNote();
      openNotes(note && note.status === 'sent' ? 'outbox' : 'drafts');
      return;
    }
    if (state.screen === 'read') {
      openNotes();
    }
  }

  function onResize() {
    var stage = byId('composeStage') || byId('readStage');
    if (!stage) return;
    var note = state.screen === 'compose' ? composeNote() : noteById(state.noteId);
    if (!note) return;
    fitStage(stage, note.pageHeight);
  }

  // ---------------------------------------------------------------- boot

  document.addEventListener('click', onClick);
  document.addEventListener('click', onFormatClick);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);

  if (state.screen === 'compose' && !composeNote()) state.screen = 'notes';
  render();
})();
