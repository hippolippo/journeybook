// Mock data and art options for the Notes prototype.
// Nothing here talks to a backend; it is a faithful copy of the intended
// shipping shape (rich letter, paper, envelope) for trying the flow out.
(function () {
  'use strict';

  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;
  var now = Date.now();

  var users = [
    { id: 'wren', name: 'Wren', role: 'her', email: 'wren@example.com' },
    { id: 'finn', name: 'Finn', role: 'him', email: 'finn@example.com' },
  ];

  // The ten asset-defined note papers from the real scrapbook editor, plus the
  // transparent sentinel. Rules are decorative on rich text: mixed font sizes
  // cannot sit on one baseline, so the prototype uses a fixed 32px rhythm.
  var papers = [
    {
      id: 'lined',
      label: 'Lined',
      color: '#fdf8ef',
      colorable: true,
      lines: 'lined',
      palette: ['#fdf8ef', '#f7e6e2', '#e6efe4', '#e4eef4', '#f6eccb', '#ebe3f1', '#ffffff'],
    },
    {
      id: 'sticky',
      label: 'Sticky note',
      color: '#f6e8a8',
      colorable: true,
      sheen: true,
      palette: ['#f6e8a8', '#f7c9c9', '#cfe3c5', '#cfe0ea', '#e6dcf0', '#fdf8ef', '#e8d3b0', '#d9e6c9'],
    },
    {
      id: 'grid',
      label: 'Grid',
      color: '#ffffff',
      colorable: true,
      lines: 'grid',
      palette: ['#ffffff', '#fdf8ef', '#f7e6e2', '#e6efe4', '#e4eef4', '#ebe3f1'],
    },
    {
      id: 'dots',
      label: 'Dot grid',
      color: '#ffffff',
      colorable: true,
      lines: 'dots',
      palette: ['#ffffff', '#fdf8ef', '#f7e6e2', '#e6efe4', '#e4eef4', '#ebe3f1'],
    },
    {
      id: 'kraft',
      label: 'Kraft',
      color: '#e0cca6',
      colorable: true,
      texture: true,
      palette: ['#e0cca6', '#d8c3a0', '#cbb289', '#e8d9c0', '#f0e4cc', '#c9a86f'],
    },
    {
      id: 'index',
      label: 'Index card',
      color: '#fdf8ef',
      colorable: true,
      lines: 'lined',
      margin: true,
      palette: ['#fdf8ef', '#ffffff', '#f7e6e2', '#e4eef4', '#e6efe4'],
    },
    {
      id: 'wide',
      label: 'Wide ruled',
      color: '#fdf8ef',
      colorable: true,
      lines: 'lined',
      spacing: 2,
      palette: ['#fdf8ef', '#f7e6e2', '#e6efe4', '#e4eef4', '#f6eccb', '#ebe3f1'],
    },
  ];

  var envelopeTints = [
    { id: 'kraft', label: 'Kraft', color: '#d9b98c' },
    { id: 'cream', label: 'Cream', color: '#f4e6ca' },
    { id: 'blush', label: 'Blush', color: '#e8b4af' },
    { id: 'sage', label: 'Sage', color: '#cadcb9' },
    { id: 'sky', label: 'Sky', color: '#cfe0ea' },
    { id: 'lilac', label: 'Lilac', color: '#d8d3e8' },
    { id: 'terracotta', label: 'Terracotta', color: '#d59a79' },
    { id: 'charcoal', label: 'Charcoal', color: '#4d4640' },
  ];

  var sealColors = [
    { id: 'rose', label: 'Rose', color: '#c56a6a' },
    { id: 'wine', label: 'Wine', color: '#8a3b3b' },
    { id: 'mustard', label: 'Mustard', color: '#c99a3e' },
    { id: 'sage', label: 'Sage', color: '#7e8f6b' },
    { id: 'sky', label: 'Sky', color: '#6f9fb0' },
    { id: 'ink', label: 'Ink', color: '#4a3b2e' },
  ];

  var stamps = [
    { id: 'fern', label: 'Fern', art: 'assets/svg/stamp-fern.svg' },
    { id: 'heart', label: 'Heart', art: 'assets/svg/stamp-heart.svg' },
    { id: 'moon', label: 'Moon', art: 'assets/svg/stamp-moon.svg' },
    { id: 'bird', label: 'Bird', art: 'assets/svg/stamp-bird.svg' },
  ];

  var fonts = [
    { id: 'caveat', label: 'Pen', family: "'Caveat', cursive" },
    { id: 'neat', label: 'Neat', family: "'Patrick Hand', cursive" },
    { id: 'marker', label: 'Marker', family: "'Permanent Marker', cursive" },
    { id: 'brush', label: 'Brush', family: "'Caveat Brush', cursive" },
    { id: 'pencil', label: 'Pencil', family: "'Architects Daughter', cursive" },
    { id: 'script', label: 'Script', family: "'Homemade Apple', cursive" },
    { id: 'thin', label: 'Thin pen', family: "'Shadows Into Light', cursive" },
    { id: 'round', label: 'Round', family: "'Shantell Sans', cursive" },
    { id: 'chalk', label: 'Chalk', family: "'Gochi Hand', cursive" },
    { id: 'journal', label: 'Journal', family: "'Kalam', cursive" },
    { id: 'print', label: 'Print', family: "'Nunito', system-ui, sans-serif" },
    { id: 'serif', label: 'Serif', family: "'Fraunces', Georgia, serif" },
  ];

  var sizes = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48];
  var inks = ['#4a3b2e', '#2f3134', '#8a3b3b', '#3b5c8a', '#3b6b4f', '#7a4a8a', '#b06a2c', '#fbf6ec'];
  var highlights = ['#f5e6a8', '#f7c9c9', '#cfe3c5', '#cfe0ea', '#e6dcf0'];

  function sent(id, authorId, recipientId, age, openedAge, bodyHtml, paper, paperColor, pageHeight, envelope) {
    return {
      id: id,
      authorId: authorId,
      recipientId: recipientId,
      status: 'sent',
      paper: paper,
      paperColor: paperColor,
      pageHeight: pageHeight,
      bodyHtml: bodyHtml,
      envelope: envelope,
      createdAt: now - age - 2 * HOUR,
      updatedAt: now - age,
      sentAt: now - age,
      openedAt: openedAge ? now - openedAge : 0,
      trashedAt: 0,
    };
  }

  var notes = [
    sent(
      'n-fern',
      'finn',
      'wren',
      3 * DAY,
      2 * DAY,
      "<p><span style='font-family:\"Fraunces\",Georgia,serif;font-size:25px;font-weight:600;color:#8a3b3b'>My Wren,</span></p>" +
        "<p><span style='font-family:\"Caveat\",cursive;font-size:22px'>The kettle's on and the flat is very quiet without you. I found your hairpin on the windowsill again — I've put it in the little dish by the door so you can find it when you're next here.</span></p>" +
        "<p style='text-align:center'><span style='font-family:\"Homemade Apple\",cursive;font-size:19px;color:#3b5c8a'>three weeks and two sleeps</span></p>" +
        "<p style='text-align:right'><span style='font-family:\"Caveat\",cursive;font-size:21px'>yours, always<br>Finn</span></p>",
      'lined',
      '#fdf8ef',
      560,
      { tint: '#d9b98c', seal: '#8a3b3b', initial: 'F', stamp: 'fern' },
    ),
    sent(
      'n-bookshop',
      'finn',
      'wren',
      6 * HOUR,
      0,
      "<p><span style='font-family:\"Caveat\",cursive;font-size:25px'>Guess what I did today.</span></p>" +
        "<p><span style='font-family:\"Patrick Hand\",cursive;font-size:19px'>I walked past the bookshop with the green door and thought of the afternoon we spent in there hiding from the rain. So I bought the little poetry book you were holding the whole time.</span></p>" +
        "<p style='text-align:center'><span style='font-family:\"Caveat Brush\",cursive;font-size:27px;color:#8a3b3b'>open this one when you miss me</span></p>",
      'sticky',
      '#f7c9c9',
      520,
      { tint: '#e8b4af', seal: '#c56a6a', initial: 'F', stamp: 'heart' },
    ),
    sent(
      'n-tea',
      'wren',
      'finn',
      2 * DAY,
      0,
      "<p><span style='font-family:\"Caveat\",cursive;font-size:24px'>Dear Finn,</span></p>" +
        "<p><span style='font-family:\"Kalam\",cursive;font-size:18px'>I made the tea you like and sat by the window where the light comes in at four. It's not the same chair, but I pretended for a minute.</span></p>" +
        "<p><span style='font-family:\"Kalam\",cursive;font-size:18px'>Wear the jumper I stole back to you. <span style='text-decoration:underline;text-decoration-color:#d98c8c'>I miss you in the ordinary way</span> — not the dramatic way, just the kettle-and-two-mugs way.</span></p>" +
        "<p style='text-align:right'><span style='font-family:\"Caveat\",cursive;font-size:22px'>all my love, Wren</span></p>",
      'dots',
      '#fdf8ef',
      680,
      { tint: '#cfe0ea', seal: '#6f9fb0', initial: 'W', stamp: 'moon' },
    ),
    sent(
      'n-postcard',
      'wren',
      'finn',
      8 * DAY,
      8 * DAY - 2 * HOUR,
      "<p style='text-align:center'><span style='font-family:\"Fraunces\",Georgia,serif;font-size:22px;color:#3b6b4f'>The ordinary news</span></p>" +
        "<p style='text-align:center'><span style='font-family:\"Shadows Into Light\",cursive;font-size:19px'>I finally hung the little shelf. It is crooked. I am leaving it crooked because you would have laughed and then fixed it.</span></p>" +
        "<p style='text-align:center'><span style='font-family:\"Caveat\",cursive;font-size:20px;background-color:#f5e6a8'>still counting the sleeps</span></p>" +
        "<p style='text-align:right'><span style='font-family:\"Caveat\",cursive;font-size:21px'>W.</span></p>",
      'kraft',
      '#e0cca6',
      480,
      { tint: '#f4e6ca', seal: '#c99a3e', initial: 'W', stamp: 'bird' },
    ),
    {
      id: 'n-draft-wren',
      authorId: 'wren',
      recipientId: 'finn',
      status: 'draft',
      paper: 'sticky',
      paperColor: '#cfe3c5',
      pageHeight: 500,
      bodyHtml:
        "<p><span style='font-family:\"Caveat\",cursive;font-size:24px'>Finn —</span></p>" +
        "<p><span style='font-family:\"Caveat\",cursive;font-size:21px'>I started writing this three times. The first two were too soppy. This one is probably also too soppy, but it's the honest one.</span></p>" +
        "<p><span style='font-family:\"Caveat\",cursive;font-size:21px'>I keep thinking about the airport and how you waved until I was all the way through the gate.</span></p>",
      envelope: { tint: '#cadcb9', seal: '#7e8f6b', initial: 'W', stamp: 'fern' },
      createdAt: now - 1 * DAY,
      updatedAt: now - 1 * DAY,
      sentAt: 0,
      openedAt: 0,
      trashedAt: 0,
    },
    {
      id: 'n-draft-finn',
      authorId: 'finn',
      recipientId: 'wren',
      status: 'draft',
      paper: 'index',
      paperColor: '#fdf8ef',
      pageHeight: 430,
      bodyHtml:
        "<p><span style='font-family:\"Patrick Hand\",cursive;font-size:19px'>Things to tell you, in no order:</span></p>" +
        "<p><span style='font-family:\"Patrick Hand\",cursive;font-size:18px'>1. The radiator makes the noise again.<br>2. I found a café that does the little orange cakes.<br>3. I'm proud of you.</span></p>",
      envelope: { tint: '#f4e6ca', seal: '#c56a6a', initial: 'F', stamp: 'bird' },
      createdAt: now - 2 * HOUR,
      updatedAt: now - 2 * HOUR,
      sentAt: 0,
      openedAt: 0,
      trashedAt: 0,
    },
  ];

  window.JB_NOTES = {
    users: users,
    notes: notes,
    papers: papers,
    envelopeTints: envelopeTints,
    sealColors: sealColors,
    stamps: stamps,
    fonts: fonts,
    sizes: sizes,
    inks: inks,
    highlights: highlights,
    nextVisit: '2026-11-19',
  };
})();
