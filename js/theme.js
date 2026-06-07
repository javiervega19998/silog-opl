// ══════════════════════════════════════════════
// THEME — SILOG SpA
// Dark/Light mode toggle con persistencia
// ══════════════════════════════════════════════

(function() {
  var DARK = {
    '--bg':'#060D1F','--surface':'#0D1B35','--surface2':'#142040',
    '--text':'#E8EEF8','--text2':'#8A9DC0','--border':'#1E3056',
  };
  var LIGHT = {
    '--bg':'#F0F2F5','--surface':'#FFFFFF','--surface2':'#F8F9FA',
    '--text':'#1A1A2E','--text2':'#6B7280','--border':'#E5E7EB',
  };

  function applyTheme(mode) {
    var vars = mode === 'light' ? LIGHT : DARK;
    var root = document.documentElement;
    Object.keys(vars).forEach(function(k) { root.style.setProperty(k, vars[k]); });
    // Nav background
    var navs = document.querySelectorAll('.nav');
    navs.forEach(function(n) {
      n.style.background = mode === 'light' ? 'rgba(255,255,255,.95)' : 'rgba(13,27,53,.95)';
    });
    document.body.setAttribute('data-theme', mode);
    localStorage.setItem('silog_theme', mode);
    // Update toggle icon
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = mode === 'light' ? '🌙' : '☀️';
  }

  function toggleTheme() {
    var current = localStorage.getItem('silog_theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Auto-init on DOMContentLoaded
  function initTheme() {
    var saved = localStorage.getItem('silog_theme') || 'dark';
    applyTheme(saved);
  }

  // Expose globally
  window.toggleTheme = toggleTheme;
  window.initTheme   = initTheme;

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();
