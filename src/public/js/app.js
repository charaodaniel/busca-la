// Busca Lá - Client App Script

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/src/public/sw.js').catch((err) => {
      console.log('SW registration error:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Action buttons interaction
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const text = btn.innerText.trim();
      if (text === 'Aceitar entrega') {
        btn.innerText = 'Entrega aceita!';
        btn.style.backgroundColor = '#16a34a';
        btn.disabled = true;
      }
    });
  });
});
