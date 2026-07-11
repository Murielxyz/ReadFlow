/**
 * EPUB 阅读器 HTML 模板
 *
 * 使用 epub.js (CDN) 在 WebView 中渲染 EPUB 文件。
 * 与 React Native 通过 postMessage 双向通信：
 * - WebView → RN: { type: 'location', percentage, cfi, chapter }
 * - RN → WebView: injectJavaScript 调用全局函数
 */

export function getEpubReaderHTML(bookUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* === 主题 === */
  body { background: #FFFFFF; }
  body.sepia { background: #F4ECD8; }
  body.dark  { background: #1F1F1F; }

  #viewer {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    overflow: hidden;
  }

  /* epub.js 内部 iframe 样式覆盖 */
  body.light  #viewer iframe { background: #FFFFFF !important; }
  body.sepia  #viewer iframe { background: #F4ECD8 !important; }
  body.dark   #viewer iframe { background: #1F1F1F !important; color-scheme: dark; }

  /* 加载指示器 */
  #loading {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-family: -apple-system, sans-serif;
    font-size: 14px; color: #77767E;
  }
  body.dark #loading { color: #C8C5CE; }
</style>
</head>
<body class="light">
  <div id="viewer"></div>
  <div id="loading">加载中...</div>

<script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js">
</script>

<script>
  const BOOK_URL = ${JSON.stringify(bookUrl)};
  let rendition = null;
  let currentChapter = '';

  // ===== 全局命令函数（供 RN 通过 injectJavaScript 调用） =====

  /** 上一页 */
  function readerPrev() {
    if (rendition) rendition.prev();
  }

  /** 下一页 */
  function readerNext() {
    if (rendition) rendition.next();
  }

  /** 设置字体大小 (80-200) */
  function readerSetFontSize(size) {
    var viewer = document.getElementById('viewer');
    if (viewer) viewer.style.fontSize = size + '%';
  }

  /** 设置主题: 'light' | 'sepia' | 'dark' */
  function readerSetTheme(theme) {
    document.body.className = theme;
    var viewer = document.getElementById('viewer');
    if (!viewer) return;
    var iframe = viewer.querySelector('iframe');
    if (!iframe) return;
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;

    if (theme === 'dark') {
      doc.body.style.color = '#E5E2E1';
      doc.body.style.background = '#1F1F1F';
    } else if (theme === 'sepia') {
      doc.body.style.color = '#1F1F1F';
      doc.body.style.background = '#F4ECD8';
    } else {
      doc.body.style.color = '#1F1F1F';
      doc.body.style.background = '#FFFFFF';
    }
  }

  /** 跳转到指定百分比 */
  function readerGoTo(pct) {
    if (rendition && rendition.book && rendition.book.locations) {
      var loc = rendition.book.locations.cfiFromPercentage(pct / 100);
      if (loc) rendition.display(loc);
    }
  }

  /** 获取目录 → 发送到 RN */
  function readerGetToc() {
    if (!rendition || !rendition.book) return;
    var nav = rendition.book.navigation;
    if (!nav || !nav.toc) {
      sendMsg({ type: 'toc', items: [] });
      return;
    }
    var items = [];
    function flatten(nodes, depth) {
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        items.push({ label: n.label || '', href: n.href || '', depth: depth });
        if (n.subitems && n.subitems.length > 0) {
          flatten(n.subitems, depth + 1);
        }
      }
    }
    flatten(nav.toc, 0);
    sendMsg({ type: 'toc', items: items });
  }

  /** 跳转到指定 href（目录跳转用） */
  function readerGoToHref(href) {
    if (rendition) rendition.display(href);
  }

  // ===== 发送消息到 RN =====
  function sendMsg(data) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    } catch(e) {}
  }

  // ===== 文字选中 → 高亮 =====
  function setupTextSelection() {
    var viewer = document.getElementById('viewer');
    if (!viewer) return;

    // 移除旧按钮（如果存在）
    var oldBtn = document.getElementById('__rf_highlight_btn');
    if (oldBtn) oldBtn.parentNode.removeChild(oldBtn);

    var iframe = viewer.querySelector('iframe');
    if (!iframe) return;

    var doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow.document;
    } catch(e) { return; }
    if (!doc) return;

    // 创建浮动高亮按钮
    var btn = document.createElement('div');
    btn.id = '__rf_highlight_btn';
    btn.innerHTML = '🖍️';
    btn.style.cssText =
      'position:fixed;z-index:99999;width:44px;height:44px;' +
      'border-radius:22px;background:#7C6BFF;color:#fff;' +
      'display:none;align-items:center;justify-content:center;' +
      'font-size:20px;cursor:pointer;' +
      'box-shadow:0 2px 12px rgba(0,0,0,0.3);' +
      'transition:transform 0.15s ease;' +
      '-webkit-tap-highlight-color:transparent;';
    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      var sel = doc.getSelection();
      var text = sel ? sel.toString().trim() : '';
      if (text) {
        sendMsg({ type: 'highlight', content: text, chapter: currentChapter });
      }
      btn.style.display = 'none';
      if (sel) sel.removeAllRanges();
    };
    // 触摸反馈
    btn.ontouchstart = function() { btn.style.transform = 'scale(0.9)'; };
    btn.ontouchend = function() { btn.style.transform = 'scale(1)'; };
    document.body.appendChild(btn);

    // 显示/隐藏按钮的通用逻辑
    function showHighlightButton() {
      setTimeout(function() {
        var sel = doc.getSelection();
        var text = sel ? sel.toString().trim() : '';
        if (text && text.length > 0 && sel.rangeCount > 0) {
          var range = sel.getRangeAt(0);
          var rect = range.getBoundingClientRect();
          if (!rect || (rect.width === 0 && rect.height === 0)) {
            btn.style.display = 'none';
            return;
          }
          // 按钮放在选中区域右上角外侧
          var left = Math.min(rect.right + 6, window.innerWidth - 50);
          var top = Math.max(rect.top - 50, 6);
          btn.style.left = left + 'px';
          btn.style.top = top + 'px';
          btn.style.display = 'flex';
        } else {
          btn.style.display = 'none';
        }
      }, 10);
    }

    doc.addEventListener('mouseup', showHighlightButton);
    doc.addEventListener('touchend', showHighlightButton);

    // 点击其他区域隐藏按钮
    doc.addEventListener('mousedown', function(e) {
      if (e.target !== btn && !btn.contains(e.target)) {
        btn.style.display = 'none';
      }
    });
    doc.addEventListener('touchstart', function(e) {
      if (e.target !== btn && !btn.contains(e.target)) {
        btn.style.display = 'none';
      }
    });
  }

  // ===== 初始化 epub.js =====
  function init() {
    try {
      var book = ePub(BOOK_URL);
      rendition = book.renderTo('viewer', {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        manager: 'default'
      });

      // 位置变化 → 通知 RN
      rendition.on('relocated', function(loc) {
        var pct = loc.start.percentage || 0;
        var chapter = '';
        try {
          var nav = book.navigation;
          if (nav) {
            var item = nav.get(loc.start.href);
            if (item) chapter = item.label || '';
          }
        } catch(e) {}
        currentChapter = chapter;

        sendMsg({
          type: 'location',
          percentage: Math.round(pct * 100),
          cfi: loc.start.cfi,
          chapter: chapter
        });

        // 翻页后重新绑定文字选择（iframe 可能被重建）
        setTimeout(setupTextSelection, 300);
      });

      // 渲染完成 → 隐藏加载指示器 + 绑定文字选择
      rendition.display().then(function() {
        var loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
        setTimeout(setupTextSelection, 500);
      });

      // 生成 locations（用于精确跳转）
      book.ready.then(function() {
        return book.locations.generate(1600);
      }).then(function() {
        sendMsg({ type: 'ready', totalPages: book.locations.total || 0 });
      }).catch(function() {});

    } catch(e) {
      sendMsg({ type: 'error', message: e.message });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>`;
}

/**
 * PDF 阅读器 HTML 模板
 *
 * 使用 PDF.js (CDN) 在 WebView 中渲染 PDF 文件。
 * 兼容 iOS 和 Android。
 */
export function getPdfReaderHTML(pdfUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #525659; }

  #container {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  canvas {
    display: block;
    margin: 0 auto 4px auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    max-width: 100%;
    height: auto !important;
  }

  #loading {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-family: -apple-system, sans-serif;
    font-size: 14px; color: #C8C5CE;
  }
</style>
</head>
<body>
  <div id="container"></div>
  <div id="loading">加载 PDF...</div>

<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js">
</script>

<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const PDF_URL = ${JSON.stringify(pdfUrl)};
  let currentPage = 1;
  let totalPages = 0;

  function sendMsg(data) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    } catch(e) {}
  }

  // 全局命令
  function readerPrev() {
    if (currentPage > 1) renderPage(currentPage - 1);
  }

  function readerNext() {
    if (currentPage < totalPages) renderPage(currentPage + 1);
  }

  function readerSetTheme(theme) {
    if (theme === 'dark') {
      document.body.style.background = '#1F1F1F';
    } else {
      document.body.style.background = '#525659';
    }
  }

  function readerGoTo(pct) {
    var page = Math.max(1, Math.round((pct / 100) * totalPages));
    renderPage(page);
  }

  async function renderPage(num) {
    try {
      var pdf = await pdfjsLib.getDocument(PDF_URL).promise;
      totalPages = pdf.numPages;
      currentPage = Math.max(1, Math.min(num, totalPages));

      var page = await pdf.getPage(currentPage);
      var container = document.getElementById('container');
      var viewport = page.getViewport({ scale: 1 });
      var scale = (window.innerWidth - 16) / viewport.width;
      viewport = page.getViewport({ scale: scale });

      // 清除旧 canvas
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      container.appendChild(canvas);

      var ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // 滚动到顶部
      container.scrollTop = 0;

      var pct = Math.round((currentPage / totalPages) * 100);
      sendMsg({ type: 'location', percentage: pct, page: currentPage, totalPages: totalPages });

      var loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';
    } catch(e) {
      sendMsg({ type: 'error', message: e.message });
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    renderPage(1);
  });
</script>
</body>
</html>`;
}
