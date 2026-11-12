/* BaoHim Photo V4 — Interactive Preview Controller */
(function (global) {
  'use strict';

  var F = global.BaoHimV4Filters;

  var ASSET_BASE = (function () {
    if (global.location.hostname !== 'htmlpreview.github.io') return '../assets/';
    var m = global.location.search.match(/github\.com\/([^/]+\/[^/]+)\/blob\/([^/?#]+)\//);
    if (m) return 'https://cdn.jsdelivr.net/gh/' + m[1] + '@' + m[2] + '/assets/';
    return 'https://raw.githubusercontent.com/kanz510/BaoHim-Photo/preview/v4-immersive/assets/';
  })();

  function assetUrl(rel) {
    return String(rel || '').replace(/^\.\.\/assets\//, ASSET_BASE);
  }

  var RECENT_ITEMS = [
    { id: 'muse', title: 'Nàng thơ studio', meta: '1200×1500 · Portra 400', src: assetUrl('../assets/photos/muse.jpg'), preset: 'portra-400', group: 'film' },
    { id: 'portrait', title: 'Chân dung ánh xanh', meta: '1200×1500 · Seoul Soft', src: assetUrl('../assets/photos/portrait.jpg'), preset: 'seoul-soft', group: 'korean' },
    { id: 'sunlight', title: 'Nắng chiều', meta: '1200×1500 · Kyoto Air', src: assetUrl('../assets/photos/sunlight.jpg'), preset: 'kyoto-air', group: 'japanese' }
  ];

  var STYLE_COLLECTIONS = [
    { id: 'film', name: 'Film 35mm', sub: 'Kodak · Portra · Cine', src: assetUrl('../assets/photos/sunlight.jpg'), preset: 'kodak-2383' },
    { id: 'ccd', name: 'CCD Digicam', sub: 'Flash 2004 · Trong trẻo', src: assetUrl('../assets/photos/portrait.jpg'), preset: 'ccd-flash' },
    { id: 'korean', name: 'Hàn Trong Veo', sub: 'Seoul Soft · Sáng da', src: assetUrl('../assets/photos/muse.jpg'), preset: 'seoul-soft' },
    { id: 'chinese', name: 'Trung Cổ Điển', sub: 'Bạch liên · Hồng Kông', src: assetUrl('../assets/photos/muse.jpg'), preset: 'peony-cn' },
    { id: 'japanese', name: 'Nhật Mờ Sương', sub: 'Kyoto Air · Tokyo 07', src: assetUrl('../assets/photos/sunlight.jpg'), preset: 'kyoto-air' },
    { id: 'vintage', name: 'Vintage Diary', sub: 'Giấy cũ · 90s Film', src: assetUrl('../assets/photos/portrait.jpg'), preset: 'diary-90' }
  ];

  var BEAUTY_TOOLS = [
    { id: 'smooth', label: 'Mịn da', icon: 'smooth', real: true, defaultVal: 55 },
    { id: 'brighten', label: 'Sáng da', icon: 'sun', real: true, defaultVal: 45 },
    { id: 'blemish', label: 'Xóa mụn', icon: 'blemish', real: false, demo: true, defaultVal: 50 },
    { id: 'face', label: 'Chỉnh mặt', icon: 'face', real: false, demo: true, defaultVal: 35 },
    { id: 'body', label: 'Vóc dáng', icon: 'body', real: false, demo: true, defaultVal: 30 }
  ];

  var FACE_SUB_PARAMS = [
    { id: 'vline', label: 'Thon mặt' },
    { id: 'eyes', label: 'Sáng mắt' },
    { id: 'nose', label: 'Gọn mũi' },
    { id: 'jaw', label: 'Viền hàm' }
  ];

  var BODY_SUB_PARAMS = [
    { id: 'waist', label: 'Eo thon' },
    { id: 'shoulder', label: 'Gọn vai' },
    { id: 'legs', label: 'Kéo chân' }
  ];

  var MAKEUP_PARTS = [
    {
      id: 'lips',
      label: 'Môi',
      icon: 'lips',
      swatches: ['#B84B62', '#C96B96', '#9E3245', '#D67A6E', '#C45A4A', '#E29098']
    },
    {
      id: 'blush',
      label: 'Má',
      icon: 'blush',
      swatches: ['#DF8092', '#EA9888', '#D1749A', '#E6A49B', '#B86A8C']
    },
    {
      id: 'eyes',
      label: 'Mắt',
      icon: 'eye',
      swatches: ['#8A625B', '#68505C', '#B48272', '#4D4754', '#C48A95']
    },
    {
      id: 'brow',
      label: 'Lông mày',
      icon: 'brow',
      swatches: ['#4B3D38', '#6B5750', '#312A2A', '#856F65']
    }
  ];

  var el = function (id) {
    return document.getElementById(id);
  };

  var state = {
    screen: 'home',
    mode: 'filters', // 'filters' | 'beauty' | 'makeup'
    docTitle: 'Chân dung ánh xanh',
    srcUrl: '../assets/photos/portrait.jpg',
    baseCanvas: document.createElement('canvas'),
    workCanvas: document.createElement('canvas'), // persistent strokes (beauty + makeup)
    previewCanvas: null,
    origImageData: null,
    workImageData: null,
    thumbSource: null,

    // Filter draft & committed state
    filterGroup: 'all',
    committedFilter: 'original',
    committedFilterIntensity: 85,
    draftFilter: 'original',
    draftFilterIntensity: 85,

    // Beauty & Makeup state
    beautyTool: 'smooth',
    beautyValues: { smooth: 55, brighten: 45, blemish: 50, face: 35, body: 30 },
    faceParam: 'vline',
    bodyParam: 'waist',
    brushRadius: 44,

    makeupPart: 'lips',
    makeupColor: '#C96B96',
    makeupIntensity: 58,

    // Undo / Redo snapshots (pixel snapshots of workCanvas + filter metadata)
    undoStack: [],
    redoStack: [],
    comparing: false,

    // Viewport state (Contain fit vs manual pinch/pan)
    fitted: true,
    zoom: 1,
    fitZoom: 1,
    panX: 0,
    panY: 0,
    docWidth: 1200,
    docHeight: 1500
  };

  var toastTimer = null;
  function showToast(msg) {
    var node = el('v4-toast');
    if (!node) return;
    node.textContent = msg;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.hidden = true;
    }, 2400);
  }

  function hydrateAllIcons(root) {
    (root || document).querySelectorAll('[data-v4-icon]').forEach(function (node) {
      node.innerHTML = F.iconSvg(node.dataset.v4Icon);
    });
  }

  function renderHomeRails() {
    var recentRail = el('v4-recent-rail');
    recentRail.innerHTML = RECENT_ITEMS.map(function (item) {
      return (
        '<button class="v4-recent-card" data-open-recent="' + item.id + '" type="button">' +
        '<div class="v4-recent-thumb"><img src="' + item.src + '" alt="' + item.title + '"></div>' +
        '<div class="v4-recent-meta"><strong>' + item.title + '</strong><small>' + item.meta + '</small></div>' +
        '</button>'
      );
    }).join('');

    var styleRail = el('v4-style-rail');
    styleRail.innerHTML = STYLE_COLLECTIONS.map(function (item) {
      return (
        '<button class="v4-style-card" data-open-style="' + item.id + '" type="button">' +
        '<img src="' + item.src + '" alt="' + item.name + '">' +
        '<div class="v4-style-overlay"><strong>' + item.name + '</strong><small>' + item.sub + '</small></div>' +
        '</button>'
      );
    }).join('');
  }

  function computeFitZoom() {
    var stage = el('v4-stage');
    if (!stage || !state.docWidth || !state.docHeight) return 1;
    var rect = stage.getBoundingClientRect();
    var padW = Math.max(40, rect.width - 20);
    var padH = Math.max(40, rect.height - 16);
    return Math.min(padW / state.docWidth, padH / state.docHeight, 4);
  }

  function applyCanvasTransform() {
    var wrap = el('v4-canvas-wrap');
    var canvas = state.previewCanvas;
    if (!wrap || !canvas) return;
    var cssW = Math.max(1, Math.round(state.docWidth * state.fitZoom));
    var cssH = Math.max(1, Math.round(state.docHeight * state.fitZoom));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var relScale = state.zoom / (state.fitZoom || 1);
    wrap.style.transform = 'translate3d(' + state.panX.toFixed(1) + 'px,' + state.panY.toFixed(1) + 'px,0) scale(' + relScale.toFixed(4) + ')';

    var pct = Math.round((state.zoom / (state.fitZoom || 1)) * 100);
    var badge = el('v4-zoom-badge');
    if (badge) badge.textContent = pct + '%';
    var meta = el('v4-doc-meta');
    if (meta) {
      meta.textContent = state.docWidth + ' × ' + state.docHeight + ' · ' + (state.fitted ? 'Vừa khung' : pct + '%');
    }
  }

  function fitCanvas(forceReset) {
    if (forceReset) {
      state.fitted = true;
      state.panX = 0;
      state.panY = 0;
    }
    var nextFit = computeFitZoom();
    var oldFit = state.fitZoom || nextFit;
    state.fitZoom = nextFit;
    if (state.fitted) {
      state.zoom = nextFit;
      state.panX = 0;
      state.panY = 0;
    } else if (oldFit > 0 && nextFit > 0) {
      // Preserve absolute manual zoom & pan across resize
      applyCanvasTransform();
      return;
    }
    applyCanvasTransform();
  }

  function renderComposite() {
    var canvas = state.previewCanvas;
    if (!canvas || !state.workImageData) return;
    var ctx = canvas.getContext('2d');
    if (state.comparing && state.origImageData) {
      ctx.putImageData(state.origImageData, 0, 0);
      return;
    }
    var filterId = state.mode === 'filters' ? state.draftFilter : state.committedFilter;
    var filterAmt = state.mode === 'filters' ? state.draftFilterIntensity : state.committedFilterIntensity;
    var filterObj = F.FILTERS.find(function (item) {
      return item.id === filterId;
    });
    var out = ctx.createImageData(state.workImageData.width, state.workImageData.height);
    F.applyFilterToImageData(state.workImageData, out, filterObj, filterAmt);
    ctx.putImageData(out, 0, 0);
  }

  function updateUndoButtons() {
    el('btn-undo').disabled = state.undoStack.length <= 1;
    el('btn-redo').disabled = state.redoStack.length === 0;
  }

  function pushSnapshot() {
    var ctx = state.workCanvas.getContext('2d');
    var snap = {
      pixels: ctx.getImageData(0, 0, state.workCanvas.width, state.workCanvas.height),
      filter: state.committedFilter,
      intensity: state.committedFilterIntensity
    };
    state.undoStack.push(snap);
    if (state.undoStack.length > 20) state.undoStack.shift();
    state.redoStack.length = 0;
    updateUndoButtons();
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    var wctx = state.workCanvas.getContext('2d');
    wctx.putImageData(snap.pixels, 0, 0);
    state.workImageData = wctx.getImageData(0, 0, state.workCanvas.width, state.workCanvas.height);
    state.committedFilter = snap.filter;
    state.committedFilterIntensity = snap.intensity;
    state.draftFilter = snap.filter;
    state.draftFilterIntensity = snap.intensity;
    renderComposite();
    renderToolbar();
    updateUndoButtons();
  }

  function loadImageIntoEditor(src, title, opts) {
    opts = opts || {};
    var img = new Image();
    if (/^https?:/.test(global.location.protocol) && !src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = function () {
      var maxSide = 1280;
      var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.max(1, Math.round(img.naturalWidth * scale));
      var h = Math.max(1, Math.round(img.naturalHeight * scale));

      state.docWidth = img.naturalWidth;
      state.docHeight = img.naturalHeight;
      state.docTitle = title || 'Ảnh của bạn';
      state.srcUrl = src;
      el('v4-doc-title').textContent = state.docTitle;

      state.baseCanvas.width = w;
      state.baseCanvas.height = h;
      state.baseCanvas.getContext('2d').drawImage(img, 0, 0, w, h);

      state.workCanvas.width = w;
      state.workCanvas.height = h;
      var wctx = state.workCanvas.getContext('2d');
      wctx.drawImage(img, 0, 0, w, h);

      var bctx = state.baseCanvas.getContext('2d');
      state.origImageData = bctx.getImageData(0, 0, w, h);
      state.workImageData = wctx.getImageData(0, 0, w, h);

      state.previewCanvas.width = w;
      state.previewCanvas.height = h;

      // Downscaled thumbnail source for crisp instant filter thumbnails
      var thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 96;
      thumbCanvas.height = 96;
      var tctx = thumbCanvas.getContext('2d');
      var aspect = w / h;
      var sx = 0, sy = 0, sw = w, sh = h;
      if (aspect > 1) {
        sw = h;
        sx = (w - sw) / 2;
      } else {
        sh = w;
        sy = Math.max(0, (h - sh) * 0.25);
      }
      tctx.drawImage(img, (sx / w) * img.naturalWidth, (sy / h) * img.naturalHeight, (sw / w) * img.naturalWidth, (sh / h) * img.naturalHeight, 0, 0, 96, 96);
      state.thumbSource = tctx.getImageData(0, 0, 96, 96);

      state.filterGroup = opts.group || 'all';
      state.committedFilter = opts.preset || 'original';
      state.draftFilter = state.committedFilter;
      state.committedFilterIntensity = opts.intensity != null ? opts.intensity : 85;
      state.draftFilterIntensity = state.committedFilterIntensity;
      state.undoStack = [];
      state.redoStack = [];
      pushSnapshot();

      switchScreen('editor', opts.mode || state.mode, opts.tool);
      fitCanvas(true);
      renderComposite();
    };
    img.src = src;
  }

  function switchScreen(screen, mode, subTool) {
    state.screen = screen;
    el('v4-app').dataset.screen = screen;
    el('screen-home').classList.toggle('is-active', screen === 'home');
    el('screen-editor').classList.toggle('is-active', screen === 'editor');
    if (screen === 'editor') {
      if (mode) setMode(mode, subTool, true);
      else fitCanvas(false);
    }
  }

  function setMode(mode, subTool, preserveZoom) {
    state.mode = mode;
    if (mode === 'beauty' && subTool) state.beautyTool = subTool;
    if (mode === 'makeup' && subTool) state.makeupPart = subTool;

    document.querySelectorAll('.v4-mode-pill').forEach(function (btn) {
      var active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    renderToolbar();
    renderComposite();
    if (!preserveZoom) applyCanvasTransform();
  }

  function renderFilterThumbnails() {
    if (!state.thumbSource) return;
    document.querySelectorAll('canvas[data-filter-thumb]').forEach(function (cvs) {
      var fid = cvs.dataset.filterThumb;
      var filterObj = F.FILTERS.find(function (item) {
        return item.id === fid;
      });
      var ctx = cvs.getContext('2d');
      var out = ctx.createImageData(96, 96);
      F.applyFilterToImageData(state.thumbSource, out, filterObj, 90);
      ctx.putImageData(out, 0, 0);
    });
  }

  function sliderHtml(id, label, value, min, max) {
    var pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
    return (
      '<div class="v4-slider-row">' +
      '<span class="v4-slider-label">' + label + '</span>' +
      '<input class="v4-range" id="' + id + '" type="range" min="' + min + '" max="' + max + '" value="' + value + '" style="--pct:' + pct.toFixed(1) + '%">' +
      '<span class="v4-slider-val" id="' + id + '-val">' + value + '</span>' +
      '</div>'
    );
  }

  function renderToolbar() {
    var body = el('v4-tb-body');
    if (!body) return;

    if (state.mode === 'filters') {
      var list = F.FILTERS.filter(function (f) {
        return state.filterGroup === 'all' || f.group === state.filterGroup || f.id === 'original';
      });
      body.innerHTML =
        sliderHtml('v4-filter-range', 'Mức độ', state.draftFilterIntensity, 0, 100) +
        '<div class="v4-filter-strip" id="v4-filter-strip">' +
        list.map(function (f) {
          var active = f.id === state.draftFilter;
          return (
            '<button class="v4-filter-card ' + (active ? 'is-active' : '') + '" data-preset="' + f.id + '" type="button">' +
            '<span class="v4-filter-thumb"><canvas width="96" height="96" data-filter-thumb="' + f.id + '"></canvas></span>' +
            '<span class="v4-filter-name">' + f.name + '</span>' +
            '</button>'
          );
        }).join('') +
        '</div>' +
        '<div class="v4-cat-tabs" role="tablist" aria-label="Nhóm bộ lọc">' +
        F.FILTER_GROUPS.map(function (g) {
          var active = g.id === state.filterGroup;
          return '<button class="v4-cat-tab ' + (active ? 'is-active' : '') + '" data-filter-group="' + g.id + '" type="button">' + g.label + '</button>';
        }).join('') +
        '</div>';
      renderFilterThumbnails();
      return;
    }

    if (state.mode === 'beauty') {
      var activeTool = BEAUTY_TOOLS.find(function (t) {
        return t.id === state.beautyTool;
      }) || BEAUTY_TOOLS[0];
      var val = state.beautyValues[activeTool.id] || activeTool.defaultVal;
      var subHtml = '';
      if (activeTool.id === 'face') {
        subHtml =
          '<div class="v4-subpills">' +
          FACE_SUB_PARAMS.map(function (p) {
            return '<button class="v4-subpill ' + (p.id === state.faceParam ? 'is-active' : '') + '" data-face-param="' + p.id + '" type="button">' + p.label + '</button>';
          }).join('') +
          '</div>';
      } else if (activeTool.id === 'body') {
        subHtml =
          '<div class="v4-subpills">' +
          BODY_SUB_PARAMS.map(function (p) {
            return '<button class="v4-subpill ' + (p.id === state.bodyParam ? 'is-active' : '') + '" data-body-param="' + p.id + '" type="button">' + p.label + '</button>';
          }).join('') +
          '</div>';
      } else {
        subHtml =
          '<div class="v4-status-note">' +
          '<span>' + (activeTool.real ? 'Tô trực tiếp 1 ngón lên vùng da trên ảnh' : 'Cần nối Engine Spot Heal / Liquify V3') + '</span>' +
          '<span class="v4-demo-badge">' + (activeTool.real ? 'Tương tác thật' : 'Demo UI') + '</span>' +
          '</div>';
      }

      body.innerHTML =
        '<div class="v4-tool-strip">' +
        BEAUTY_TOOLS.map(function (t) {
          var active = t.id === state.beautyTool;
          return (
            '<button class="v4-tool-chip ' + (active ? 'is-active' : '') + '" data-beauty-tool="' + t.id + '" type="button">' +
            (t.demo ? '<span class="v4-demo-dot">Demo</span>' : '') +
            F.iconSvg(t.icon) +
            '<span class="v4-chip-name">' + t.label + '</span>' +
            '</button>'
          );
        }).join('') +
        '</div>' +
        subHtml +
        sliderHtml('v4-beauty-range', activeTool.label, val, 0, 100);
      return;
    }

    // Makeup mode
    var part = MAKEUP_PARTS.find(function (p) {
      return p.id === state.makeupPart;
    }) || MAKEUP_PARTS[0];
    if (part.swatches.indexOf(state.makeupColor) === -1) {
      state.makeupColor = part.swatches[0];
    }

    body.innerHTML =
      '<div class="v4-cat-tabs" role="tablist" aria-label="Vùng trang điểm">' +
      MAKEUP_PARTS.map(function (p) {
        var active = p.id === state.makeupPart;
        return '<button class="v4-cat-tab ' + (active ? 'is-active' : '') + '" data-makeup-part="' + p.id + '" type="button">' + p.label + '</button>';
      }).join('') +
      '</div>' +
      '<div class="v4-swatch-row">' +
      '<div class="v4-swatches">' +
      part.swatches.map(function (hex) {
        var active = hex === state.makeupColor;
        return '<button class="v4-swatch ' + (active ? 'is-active' : '') + '" data-swatch="' + hex + '" style="background:' + hex + '" aria-label="Màu ' + hex + '" type="button"></button>';
      }).join('') +
      '</div>' +
      '<span class="v4-demo-badge">Tô cọ thật · Auto Demo</span>' +
      '</div>' +
      sliderHtml('v4-makeup-range', 'Cường độ', state.makeupIntensity, 0, 100);
  }

  // Soft pixel brush stroke on state.workCanvas (real interactive preview for smooth/brighten/makeup)
  function hexToRgb(hex) {
    var clean = hex.replace('#', '');
    var n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function applyLocalBrushDab(imgX, imgY) {
    if (!state.workImageData) return;
    var w = state.workCanvas.width;
    var h = state.workCanvas.height;
    var radius = Math.max(14, Math.round((state.brushRadius / (state.zoom || 1)) * 0.65));
    var r2 = radius * radius;
    var x0 = Math.max(1, Math.floor(imgX - radius));
    var y0 = Math.max(1, Math.floor(imgY - radius));
    var x1 = Math.min(w - 2, Math.ceil(imgX + radius));
    var y1 = Math.min(h - 2, Math.ceil(imgY + radius));
    if (x1 <= x0 || y1 <= y0) return;

    var data = state.workImageData.data;
    var copy = new Uint8ClampedArray(data);
    var mode = state.mode;

    if (mode === 'beauty' && state.beautyTool === 'smooth') {
      var strength = (state.beautyValues.smooth / 100) * 0.45;
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var dx = x - imgX;
          var dy = y - imgY;
          var d2 = dx * dx + dy * dy;
          if (d2 >= r2) continue;
          var falloff = Math.pow(1 - d2 / r2, 1.5) * strength;
          var idx = (y * w + x) * 4;
          var idxL = (y * w + (x - 1)) * 4;
          var idxR = (y * w + (x + 1)) * 4;
          var idxU = ((y - 1) * w + x) * 4;
          var idxD = ((y + 1) * w + x) * 4;
          for (var c = 0; c < 3; c++) {
            var avg = (copy[idxL + c] + copy[idxR + c] + copy[idxU + c] + copy[idxD + c] + copy[idx + c]) / 5;
            data[idx + c] = Math.round(copy[idx + c] + (avg - copy[idx + c]) * falloff);
          }
        }
      }
    } else if (mode === 'beauty' && state.beautyTool === 'brighten') {
      var boost = (state.beautyValues.brighten / 100) * 18;
      for (var y2 = y0; y2 <= y1; y2++) {
        for (var x2 = x0; x2 <= x1; x2++) {
          var dx2 = x2 - imgX;
          var dy2 = y2 - imgY;
          var d2b = dx2 * dx2 + dy2 * dy2;
          if (d2b >= r2) continue;
          var f2 = Math.pow(1 - d2b / r2, 1.6);
          var idx2 = (y2 * w + x2) * 4;
          for (var c2 = 0; c2 < 3; c2++) {
            var v = data[idx2 + c2] + boost * f2;
            data[idx2 + c2] = v > 255 ? 255 : Math.round(v);
          }
        }
      }
    } else if (mode === 'makeup') {
      var rgb = hexToRgb(state.makeupColor);
      var mAlpha = (state.makeupIntensity / 100) * 0.22;
      for (var y3 = y0; y3 <= y1; y3++) {
        for (var x3 = x0; x3 <= x1; x3++) {
          var dx3 = x3 - imgX;
          var dy3 = y3 - imgY;
          var d2c = dx3 * dx3 + dy3 * dy3;
          if (d2c >= r2) continue;
          var f3 = Math.pow(1 - d2c / r2, 1.7) * mAlpha;
          var idx3 = (y3 * w + x3) * 4;
          for (var c3 = 0; c3 < 3; c3++) {
            data[idx3 + c3] = Math.round(data[idx3 + c3] * (1 - f3) + rgb[c3] * f3);
          }
        }
      }
    }
    state.workCanvas.getContext('2d').putImageData(state.workImageData, 0, 0);
    renderComposite();
  }

  function stagePointToCanvas(clientX, clientY) {
    var rect = state.previewCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * state.workCanvas.width,
      y: ((clientY - rect.top) / rect.height) * state.workCanvas.height
    };
  }

  function canPaintInCurrentTool() {
    if (state.mode === 'makeup') return true;
    if (state.mode === 'beauty' && (state.beautyTool === 'smooth' || state.beautyTool === 'brighten')) return true;
    return false;
  }

  function bindGestures() {
    var stage = el('v4-stage');
    var activePointers = new Map();
    var pinchStartDist = 0;
    var pinchStartZoom = 1;
    var pinchMid = null;
    var panLast = null;
    var painting = false;
    var strokeMutated = false;

    function pointerDist(p1, p2) {
      return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
    }

    stage.addEventListener('pointerdown', function (e) {
      if (state.screen !== 'editor') return;
      try { stage.setPointerCapture(e.pointerId); } catch {}
      activePointers.set(e.pointerId, e);

      if (activePointers.size === 2) {
        painting = false;
        el('v4-brush-ring').hidden = true;
        var pts = Array.from(activePointers.values());
        pinchStartDist = pointerDist(pts[0], pts[1]) || 1;
        pinchStartZoom = state.zoom;
        pinchMid = { x: (pts[0].clientX + pts[1].clientX) / 2, y: (pts[0].clientY + pts[1].clientY) / 2 };
        return;
      }

      if (activePointers.size === 1) {
        var pos = stagePointToCanvas(e.clientX, e.clientY);
        if (canPaintInCurrentTool() && pos) {
          painting = true;
          strokeMutated = true;
          applyLocalBrushDab(pos.x, pos.y);
          var ring = el('v4-brush-ring');
          ring.style.width = state.brushRadius + 'px';
          ring.style.height = state.brushRadius + 'px';
          ring.style.left = e.clientX + 'px';
          ring.style.top = e.clientY + 'px';
          ring.hidden = false;
        } else {
          painting = false;
          panLast = { x: e.clientX, y: e.clientY };
        }
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, e);

      if (activePointers.size === 2) {
        var pts = Array.from(activePointers.values());
        var dist = pointerDist(pts[0], pts[1]) || 1;
        var nextZoom = Math.max(state.fitZoom * 0.6, Math.min(state.fitZoom * 5, pinchStartZoom * (dist / pinchStartDist)));
        var mid = { x: (pts[0].clientX + pts[1].clientX) / 2, y: (pts[0].clientY + pts[1].clientY) / 2 };
        state.fitted = false;
        state.zoom = nextZoom;
        if (pinchMid) {
          state.panX += mid.x - pinchMid.x;
          state.panY += mid.y - pinchMid.y;
        }
        pinchMid = mid;
        applyCanvasTransform();
        return;
      }

      if (painting) {
        var ring = el('v4-brush-ring');
        ring.style.left = e.clientX + 'px';
        ring.style.top = e.clientY + 'px';
        var pos = stagePointToCanvas(e.clientX, e.clientY);
        if (pos) applyLocalBrushDab(pos.x, pos.y);
      } else if (panLast) {
        var dx = e.clientX - panLast.x;
        var dy = e.clientY - panLast.y;
        if (Math.hypot(dx, dy) > 1.5 || !state.fitted) {
          state.fitted = false;
          state.panX += dx;
          state.panY += dy;
          panLast = { x: e.clientX, y: e.clientY };
          applyCanvasTransform();
        }
      }
    });

    function endPointer(e) {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) pinchMid = null;
      if (activePointers.size === 0) {
        el('v4-brush-ring').hidden = true;
        if (painting && strokeMutated) pushSnapshot();
        painting = false;
        strokeMutated = false;
        panLast = null;
      }
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // Trackpad / mouse wheel zoom support for desktop preview verification
    stage.addEventListener('wheel', function (e) {
      if (state.screen !== 'editor') return;
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      state.fitted = false;
      state.zoom = Math.max(state.fitZoom * 0.6, Math.min(state.fitZoom * 5, state.zoom * factor));
      applyCanvasTransform();
    }, { passive: false });
  }

  function bindEvents() {
    // Open file picker
    var triggerPick = function () {
      el('v4-file-input').click();
    };
    el('btn-home-pick').addEventListener('click', triggerPick);
    el('btn-hero-upload').addEventListener('click', triggerPick);
    el('btn-pick-in-editor').addEventListener('click', triggerPick);

    el('btn-hero-demo').addEventListener('click', function () {
      loadImageIntoEditor(assetUrl('../assets/photos/muse.jpg'), 'Nàng thơ studio', { mode: 'filters', preset: 'seoul-soft', group: 'korean', intensity: 85 });
    });

    el('v4-file-input').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var url = URL.createObjectURL(file);
      loadImageIntoEditor(url, file.name.replace(/\.[^.]+$/, ''), { mode: 'filters' });
      e.target.value = '';
    });

    // Home quick access & editorial rails
    document.addEventListener('click', function (e) {
      var quick = e.target.closest('[data-launch-mode]');
      if (quick) {
        loadImageIntoEditor(assetUrl('../assets/photos/portrait.jpg'), 'Chân dung ánh xanh', {
          mode: quick.dataset.launchMode,
          tool: quick.dataset.launchTool
        });
        return;
      }

      var recentBtn = e.target.closest('[data-open-recent]');
      if (recentBtn) {
        var r = RECENT_ITEMS.find(function (i) { return i.id === recentBtn.dataset.openRecent; });
        if (r) loadImageIntoEditor(r.src, r.title, { mode: 'filters', preset: r.preset, group: r.group, intensity: 80 });
        return;
      }

      var styleBtn = e.target.closest('[data-open-style]');
      if (styleBtn) {
        var s = STYLE_COLLECTIONS.find(function (i) { return i.id === styleBtn.dataset.openStyle; });
        if (s) loadImageIntoEditor(s.src, s.name, { mode: 'filters', preset: s.preset, group: s.id, intensity: 88 });
        return;
      }

      // Mode pills in editor toolbar
      var modeBtn = e.target.closest('.v4-mode-pill');
      if (modeBtn) {
        setMode(modeBtn.dataset.mode, null, true);
        return;
      }

      // Filter thumbnail select
      var filterCard = e.target.closest('[data-preset]');
      if (filterCard) {
        state.draftFilter = filterCard.dataset.preset;
        renderToolbar();
        renderComposite();
        return;
      }

      // Filter group tabs
      var groupTab = e.target.closest('[data-filter-group]');
      if (groupTab) {
        state.filterGroup = groupTab.dataset.filterGroup;
        renderToolbar();
        return;
      }

      // Beauty tool select
      var beautyBtn = e.target.closest('[data-beauty-tool]');
      if (beautyBtn) {
        state.beautyTool = beautyBtn.dataset.beautyTool;
        renderToolbar();
        if (['blemish', 'face', 'body'].indexOf(state.beautyTool) !== -1) {
          showToast('Bản Demo UI — chưa nối Engine V3');
        }
        return;
      }

      var faceParamBtn = e.target.closest('[data-face-param]');
      if (faceParamBtn) {
        state.faceParam = faceParamBtn.dataset.faceParam;
        renderToolbar();
        return;
      }

      var bodyParamBtn = e.target.closest('[data-body-param]');
      if (bodyParamBtn) {
        state.bodyParam = bodyParamBtn.dataset.bodyParam;
        renderToolbar();
        return;
      }

      // Makeup sub-parts & swatches
      var mPart = e.target.closest('[data-makeup-part]');
      if (mPart) {
        state.makeupPart = mPart.dataset.makeupPart;
        renderToolbar();
        return;
      }

      var swatch = e.target.closest('[data-swatch]');
      if (swatch) {
        state.makeupColor = swatch.dataset.swatch;
        renderToolbar();
      }
    });

    // Live intensity slider updates
    document.addEventListener('input', function (e) {
      var target = e.target;
      if (!target.classList.contains('v4-range')) return;
      var val = Number(target.value);
      var pct = ((val - Number(target.min)) / (Number(target.max) - Number(target.min) || 1)) * 100;
      target.style.setProperty('--pct', pct.toFixed(1) + '%');
      var out = el(target.id + '-val');
      if (out) out.textContent = val;

      if (target.id === 'v4-filter-range') {
        state.draftFilterIntensity = val;
        renderComposite();
      } else if (target.id === 'v4-beauty-range') {
        state.beautyValues[state.beautyTool] = val;
      } else if (target.id === 'v4-makeup-range') {
        state.makeupIntensity = val;
      }
    });

    // Topbar & HUD controls
    el('btn-back-home').addEventListener('click', function () {
      switchScreen('home');
    });

    el('btn-fit').addEventListener('click', function () {
      fitCanvas(true);
      showToast('Đã căn ảnh vừa khung');
    });

    el('btn-undo').addEventListener('click', function () {
      if (state.undoStack.length <= 1) return;
      var popped = state.undoStack.pop();
      state.redoStack.push(popped);
      restoreSnapshot(state.undoStack[state.undoStack.length - 1]);
    });

    el('btn-redo').addEventListener('click', function () {
      if (!state.redoStack.length) return;
      var snap = state.redoStack.pop();
      state.undoStack.push(snap);
      restoreSnapshot(snap);
    });

    // Compare original (hold or click toggle cleanly)
    var cmp = el('btn-compare');
    var startCompare = function () {
      state.comparing = true;
      cmp.classList.add('is-active');
      el('v4-compare-pill').hidden = false;
      renderComposite();
    };
    var endCompare = function () {
      if (!state.comparing) return;
      state.comparing = false;
      cmp.classList.remove('is-active');
      el('v4-compare-pill').hidden = true;
      renderComposite();
    };
    cmp.addEventListener('pointerdown', startCompare);
    cmp.addEventListener('pointerup', endCompare);
    cmp.addEventListener('pointercancel', endCompare);
    cmp.addEventListener('pointerleave', endCompare);

    // Cancel / Confirm filter draft or active tool
    el('btn-cancel-draft').addEventListener('click', function () {
      if (state.mode === 'filters') {
        state.draftFilter = state.committedFilter;
        state.draftFilterIntensity = state.committedFilterIntensity;
        renderToolbar();
        renderComposite();
        showToast('Đã hủy thay đổi bộ lọc');
      } else {
        setMode('filters', null, true);
      }
    });

    el('btn-confirm-draft').addEventListener('click', function () {
      if (state.mode === 'filters') {
        state.committedFilter = state.draftFilter;
        state.committedFilterIntensity = state.draftFilterIntensity;
        pushSnapshot();
        showToast('Đã áp dụng bộ lọc');
      } else {
        showToast('Đã lưu thao tác');
      }
    });

    // Export current composite PNG
    el('btn-export').addEventListener('click', function () {
      if (!state.previewCanvas) return;
      state.previewCanvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (state.docTitle || 'baohim-v4-preview').replace(/\s+/g, '-').toLowerCase() + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        showToast('Đã xuất ảnh PNG từ preview');
      }, 'image/png');
    });

    window.addEventListener('resize', function () {
      if (state.screen === 'editor') fitCanvas(false);
    });
  }

  function init() {
    state.previewCanvas = el('v4-canvas');
    var heroImg = document.querySelector('.v4-hero-img');
    if (heroImg && ASSET_BASE !== '../assets/') {
      heroImg.src = assetUrl('../assets/photos/muse.jpg');
    }
    hydrateAllIcons(document);
    renderHomeRails();
    bindEvents();
    bindGestures();

    // Support URL hash / query params for direct preview & QA automation
    var params = new URLSearchParams(window.location.search);
    var initScreen = params.get('screen');
    var initMode = params.get('mode') || 'filters';
    if (initScreen === 'editor') {
      loadImageIntoEditor(assetUrl('../assets/photos/portrait.jpg'), 'Chân dung ánh xanh', {
        mode: initMode,
        preset: params.get('preset') || 'seoul-soft',
        group: params.get('group') || 'all',
        intensity: 85
      });
    } else {
      // Preload default photo silently for instant first switch
      var preload = new Image();
      if (/^https?:/.test(global.location.protocol)) preload.crossOrigin = 'anonymous';
      preload.src = assetUrl('../assets/photos/portrait.jpg');
    }
  }

  // Expose minimal state API for Playwright WebKit verification
  global.BaoHimV4 = {
    state: state,
    switchScreen: switchScreen,
    setMode: setMode,
    loadImageIntoEditor: loadImageIntoEditor,
    fitCanvas: fitCanvas
  };

  document.addEventListener('DOMContentLoaded', init);
})(window);
