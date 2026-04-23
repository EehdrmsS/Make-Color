import './styles.css';

const LANGUAGE_KEY = 'make-color-content-language';
const SITE_INFO_COLLAPSED_KEY = 'make-color-site-info-collapsed';

function initSiteInfoToggle() {
  const toggleButton = document.querySelector('[data-toggle-site-info]');
  const targets = [
    document.getElementById('site-top-info'),
    document.getElementById('site-content'),
  ].filter(Boolean);
  if (!toggleButton || !targets.length) return;

  function getLabels() {
    return document.documentElement.lang === 'ko'
      ? { expand: '사이트 정보 펼치기', collapse: '사이트 정보 숨기기' }
      : { expand: 'Show site info', collapse: 'Hide site info' };
  }

  function applyState(collapsed) {
    targets.forEach(target => target.classList.toggle('is-collapsed', collapsed));
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    const labels = getLabels();
    toggleButton.textContent = collapsed ? labels.expand : labels.collapse;
    localStorage.setItem(SITE_INFO_COLLAPSED_KEY, collapsed ? '1' : '0');
  }

  const saved = localStorage.getItem(SITE_INFO_COLLAPSED_KEY) === '1';
  applyState(saved);

  toggleButton.addEventListener('click', () => {
    applyState(!targets.every(target => target.classList.contains('is-collapsed')));
  });

  window.addEventListener('site-language-change', () => {
    applyState(targets.every(target => target.classList.contains('is-collapsed')));
  });
}

export function initSiteLanguage(sectionSelector = '[data-lang]') {
  function applyLanguage(lang) {
    const normalized = lang === 'kr' ? 'kr' : 'en';
    document.documentElement.lang = normalized === 'kr' ? 'ko' : 'en';
    document.querySelectorAll(sectionSelector).forEach(section => {
      const sectionLang = section.dataset.siteLang ?? section.dataset.lang;
      section.hidden = sectionLang !== normalized;
    });
    document.querySelectorAll('[data-language-toggle]').forEach(button => {
      button.textContent = normalized === 'kr' ? 'KR / EN' : 'EN / KR';
      button.setAttribute(
        'aria-label',
        normalized === 'kr' ? 'Switch language to English' : 'Switch language to Korean',
      );
    });
    localStorage.setItem(LANGUAGE_KEY, normalized);
    window.dispatchEvent(new CustomEvent('site-language-change', { detail: { lang: normalized } }));
  }

  const saved = localStorage.getItem(LANGUAGE_KEY) || 'en';
  applyLanguage(saved);

  document.querySelectorAll('[data-language-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const current = document.documentElement.lang === 'ko' ? 'kr' : 'en';
      applyLanguage(current === 'kr' ? 'en' : 'kr');
    });
  });
}

initSiteLanguage('[data-site-lang]');
initSiteInfoToggle();
