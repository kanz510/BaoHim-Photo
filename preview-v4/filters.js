/* BaoHim Photo V4 — Real Pixel Filter Recipes & Minimal SVG Icons */
(function (global) {
  'use strict';

  var ICON_PATHS = {
    chevronLeft: 'm15 6-6 6 6 6',
    plus: 'M12 5v14M5 12h14',
    image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm0 11 5-5 4 4 3-3 6 6M15.5 8.5h.01',
    sparkle: 'm12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z',
    filters: 'M9.5 4.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm5 4a5.5 5.5 0 1 1 0 11',
    makeup: 'm14.5 3.5 5 5-8.5 9-5 1 1-5 7.5-10ZM4 20c2.8 0 4.5-1.1 4.5-3.8M16.5 5.5l-2.5 2.5',
    body: 'M8 3.5c-3 4.5 3 4.5 0 8.5s-1.5 6.5 0 8.5m8-17c3 4.5-3 4.5 0 8.5s1.5 6.5 0 8.5M10 12h4',
    undo: 'M4 10h10a5.5 5.5 0 0 1 0 11M4 10l4.5-4.5M4 10l4.5 4.5',
    redo: 'M20 10H10a5.5 5.5 0 0 0 0 11m10-11-4.5-4.5M20 10l-4.5 4.5',
    compare: 'M12 3v18m-3-3H4.5V6H9m6 12h4.5V6H15',
    fit: 'M8 3.5H4.5A1 1 0 0 0 3.5 4.5V8m16.5 0V4.5a1 1 0 0 0-1-1H16m-8 17H4.5a1 1 0 0 1-1-1V16m16.5 0v3.5a1 1 0 0 1-1 1H16',
    close: 'm6.5 6.5 11 11m0-11-11 11',
    check: 'm5 12.5 4.5 4.5L19 7',
    smooth: 'M5 14c-.8-4 1.2-8.5 7-9.5s8.5 4 7.5 8.5-3.8 7.5-7.5 6.5m-5.5-2h.01M6.5 9.5h.01M14.5 15h.01',
    blemish: 'm6 13.5 7.5-7.5a3.6 3.6 0 0 1 5.1 5.1L11.1 18.6a3.6 3.6 0 0 1-5.1-5.1Zm3.5-3.5 4.5 4.5',
    sun: 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0-4.5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4',
    face: 'M7 4.5h10a4 4 0 0 1 3 3.8v4.2c0 4.5-3.6 8-8 8s-8-3.5-8-8V8.3a4 4 0 0 1 3-3.8ZM9 11h.01M15 11h.01M9.5 15.2a3.5 3.5 0 0 0 5 0',
    lips: 'M4 12c2.5-3 4.8-3 8-1.3 3.2-1.7 5.5-1.7 8 1.3-2.5 3.6-5.2 4.8-8 4.8S6.5 15.6 4 12Zm1.5 0c2.2.8 4.4 1 6.5 1s4.3-.2 6.5-1',
    eye: 'M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6Zm9.5-2.6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z',
    blush: 'M12 20.5 4.2 12.7a4.9 4.9 0 0 1 7.8-6 4.9 4.9 0 0 1 7.8 6L12 20.5Z',
    brow: 'M4 13.5c2.2-3 5.3-4.2 9-3.6 2.6.4 5 1.4 7 2.8m-15.5 2c2.4-1.8 5.2-2.4 8.5-2 2.4.3 4.5 1 6.5 2.1'
  };

  function iconSvg(name, cls) {
    var d = ICON_PATHS[name] || ICON_PATHS.sparkle;
    return '<svg class="v4-icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  var FILTER_GROUPS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'film', label: 'Film' },
    { id: 'ccd', label: 'CCD' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'korean', label: 'Hàn' },
    { id: 'chinese', label: 'Trung' },
    { id: 'japanese', label: 'Nhật' }
  ];

  // Real pixel-level grading recipes (temperature, tint, contrast, saturation, fade, brightness)
  var FILTERS = [
    { id: 'original', name: 'Nguyên bản', group: 'all', temp: 0, tint: 0, contrast: 0, sat: 0, fade: 0, bright: 0 },
    { id: 'kodak-2383', name: 'Kodak 01', group: 'film', temp: 14, tint: -3, contrast: 14, sat: -10, fade: 8, bright: 3 },
    { id: 'portra-400', name: 'Portra 400', group: 'film', temp: 16, tint: 6, contrast: -6, sat: -14, fade: 12, bright: 7 },
    { id: 'cinestill', name: 'Cine 800', group: 'film', temp: -12, tint: 5, contrast: 18, sat: -8, fade: 6, bright: -2 },
    { id: 'ccd-flash', name: 'CCD Flash', group: 'ccd', temp: -9, tint: 4, contrast: 20, sat: 16, fade: 0, bright: 9 },
    { id: 'digicam-02', name: 'Digi 2004', group: 'ccd', temp: -6, tint: -5, contrast: 15, sat: 10, fade: 4, bright: 6 },
    { id: 'ccd-blue', name: 'Cool CCD', group: 'ccd', temp: -18, tint: 3, contrast: 12, sat: -6, fade: 3, bright: 8 },
    { id: 'diary-90', name: '90s Diary', group: 'vintage', temp: 18, tint: -8, contrast: 8, sat: -22, fade: 18, bright: 2 },
    { id: 'paper-warm', name: 'Giấy cũ', group: 'vintage', temp: 22, tint: 4, contrast: -4, sat: -28, fade: 22, bright: 4 },
    { id: 'sepia-mist', name: 'Nâu sương', group: 'vintage', temp: 20, tint: 7, contrast: 6, sat: -34, fade: 15, bright: -3 },
    { id: 'seoul-soft', name: 'Seoul Soft', group: 'korean', temp: -4, tint: 8, contrast: -12, sat: -14, fade: 6, bright: 12 },
    { id: 'hannam-glow', name: 'Hannam', group: 'korean', temp: 3, tint: 5, contrast: -8, sat: -10, fade: 8, bright: 10 },
    { id: 'peony-cn', name: 'Bạch liên', group: 'chinese', temp: 4, tint: 13, contrast: 8, sat: 4, fade: 4, bright: 9 },
    { id: 'hong-kong', name: 'Hồng Kông', group: 'chinese', temp: 10, tint: -4, contrast: 20, sat: -6, fade: 9, bright: 0 },
    { id: 'kyoto-air', name: 'Kyoto Air', group: 'japanese', temp: -7, tint: -3, contrast: -14, sat: -20, fade: 12, bright: 11 },
    { id: 'tokyo-mist', name: 'Tokyo 07', group: 'japanese', temp: -14, tint: 2, contrast: -8, sat: -16, fade: 10, bright: 8 }
  ];

  function clamp(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v;
  }

  function applyFilterToImageData(src, dst, filter, intensity) {
    var s = src.data;
    var d = dst.data;
    var amt = Math.max(0, Math.min(1, intensity / 100));
    if (!filter || filter.id === 'original' || amt === 0) {
      d.set(s);
      return;
    }

    var temp = (filter.temp || 0) * 1.15 * amt;
    var tint = (filter.tint || 0) * 0.9 * amt;
    var c = 1 + ((filter.contrast || 0) / 100) * amt;
    var sat = 1 + ((filter.sat || 0) / 100) * amt;
    var fade = (filter.fade || 0) * 1.3 * amt;
    var bright = (filter.bright || 0) * 1.45 * amt;

    for (var i = 0; i < s.length; i += 4) {
      var r = s[i];
      var g = s[i + 1];
      var b = s[i + 2];

      r = (r - 128) * c + 128 + bright + temp;
      g = (g - 128) * c + 128 + bright - tint * 0.55;
      b = (b - 128) * c + 128 + bright - temp + tint * 0.45;

      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;

      if (fade > 0) {
        r = r + (fade - r * 0.08 * amt);
        g = g + (fade - g * 0.08 * amt);
        b = b + (fade * 1.04 - b * 0.06 * amt);
      }

      d[i] = clamp(r);
      d[i + 1] = clamp(g);
      d[i + 2] = clamp(b);
      d[i + 3] = s[i + 3];
    }
  }

  global.BaoHimV4Filters = {
    iconSvg: iconSvg,
    FILTER_GROUPS: FILTER_GROUPS,
    FILTERS: FILTERS,
    applyFilterToImageData: applyFilterToImageData
  };
})(window);
