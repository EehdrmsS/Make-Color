import './styles.css';

const LANGUAGE_KEY = 'make-color-content-language';

function applyLanguage(lang) {
  const normalized = lang === 'kr' ? 'kr' : 'en';
  document.documentElement.lang = normalized === 'kr' ? 'ko' : 'en';
  document.querySelectorAll('[data-lang]').forEach(section => {
    section.hidden = section.dataset.lang !== normalized;
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

function initLanguageToggle() {
  const saved = localStorage.getItem(LANGUAGE_KEY) || 'en';
  applyLanguage(saved);

  document.querySelectorAll('[data-language-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const current = document.documentElement.lang === 'ko' ? 'kr' : 'en';
      applyLanguage(current === 'kr' ? 'en' : 'kr');
    });
  });
}

initLanguageToggle();
