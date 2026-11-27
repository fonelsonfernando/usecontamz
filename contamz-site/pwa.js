'use strict';

(function initPwaAndLanding() {
  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Ignore registration failures on unsupported contexts (e.g., file://)
      });
    });
  }

  // 2. PWA Install Prompt
  let deferredPrompt = null;
  const installBtn = document.getElementById('pwa-install-btn');
  const statusBanner = document.getElementById('pwa-status-msg');

  if (installBtn) {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredPrompt = event;
      installBtn.hidden = false;
    });

    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      installBtn.disabled = true;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.disabled = false;
      if (choice && choice.outcome === 'accepted') {
        installBtn.hidden = true;
        if (statusBanner) {
          statusBanner.textContent = 'ContaMZ instalado neste dispositivo.';
        }
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      installBtn.hidden = true;
      if (statusBanner) {
        statusBanner.textContent = 'ContaMZ instalado e pronto para uso offline.';
      }
    });
  }

  // 3. Offline / Online Status Indicator
  const networkBadge = document.getElementById('network-status');
  function updateNetworkStatus() {
    if (!networkBadge) return;
    const isOffline = !navigator.onLine;
    networkBadge.hidden = !isOffline;
    if (isOffline && statusBanner) {
      statusBanner.textContent = 'Sem ligação à internet. O ContaMZ continua a funcionar em modo offline.';
    }
  }
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // 4. Interactive Hero Simulator (index.html only)
  const simAmountInput = document.getElementById('sim-amount');
  const simNetEl = document.getElementById('sim-net');
  const simVatEl = document.getElementById('sim-vat');
  const simVatLabelEl = document.getElementById('sim-vat-label');
  const simAppLink = document.getElementById('sim-app-link');
  const simRateButtons = document.querySelectorAll('[data-sim-rate]');
  const simPresetButtons = document.querySelectorAll('[data-sim-preset]');

  if (simAmountInput && simNetEl && simVatEl) {
    let activeRate = 16;
    const moneyFormatter = new Intl.NumberFormat('pt-MZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const formatMt = val => `${moneyFormatter.format(val)} MT`;

    function updateSimulator() {
      const raw = Number(simAmountInput.value);
      const amount = Number.isFinite(raw) && raw > 0 ? raw : 0;
      const vat = activeRate === 0 ? 0 : (amount * activeRate) / (100 + activeRate);
      const net = amount - vat;

      simNetEl.textContent = formatMt(net);
      simVatEl.textContent = formatMt(vat);
      if (simVatLabelEl) {
        simVatLabelEl.textContent = activeRate === 16 ? 'IVA incluído (16%)' : 'IVA incluído (Isento)';
      }

      if (simAppLink) {
        const params = new URLSearchParams();
        if (amount > 0) params.set('valor', amount.toFixed(2));
        params.set('taxa', String(activeRate));
        simAppLink.href = `app.html?${params.toString()}`;
      }
    }

    simAmountInput.addEventListener('input', updateSimulator);

    simRateButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        activeRate = Number(btn.getAttribute('data-sim-rate')) === 0 ? 0 : 16;
        simRateButtons.forEach(other => {
          const isCurrent = other === btn;
          other.setAttribute('aria-pressed', String(isCurrent));
          other.classList.toggle('is-active', isCurrent);
        });
        updateSimulator();
      });
    });

    simPresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-sim-preset');
        if (preset) {
          simAmountInput.value = preset;
          updateSimulator();
        }
      });
    });

    updateSimulator();
  }
})();
