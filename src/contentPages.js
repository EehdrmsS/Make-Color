import './styles.css';

const LANGUAGE_KEY = 'make-color-content-language';

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
