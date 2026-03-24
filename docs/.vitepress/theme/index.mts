import DefaultTheme from 'vitepress/theme';
import './brand.css';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp() {
    if (typeof window === 'undefined') return;

    function attachLightbox() {
      document.querySelectorAll('.vp-doc img').forEach((img: Element) => {
        if ((img as HTMLElement).dataset.lightbox) return;
        (img as HTMLElement).dataset.lightbox = '1';
        img.addEventListener('click', () => {
          const overlay = document.createElement('div');
          overlay.className = 'ds-lightbox';
          const clone = document.createElement('img');
          clone.src = (img as HTMLImageElement).src;
          clone.alt = (img as HTMLImageElement).alt;
          overlay.appendChild(clone);
          overlay.addEventListener('click', () => overlay.remove());
          document.addEventListener('keydown', function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
              overlay.remove();
              document.removeEventListener('keydown', onKey);
            }
          });
          document.body.appendChild(overlay);
        });
      });
    }

    const observer = new MutationObserver(attachLightbox);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', attachLightbox);
    setTimeout(attachLightbox, 500);
  },
};
