(function() {
  const OVERLAY_ID = 'cuerpo23-click-overlay';
  const STYLE_ID = `${OVERLAY_ID}-style`;
  const TARGET_MESH_NAME = 'Cuerpo23';

  let overlayElement = null;
  let overlayTimer = null;
  let canvasElement = null;
  let observer = null;

  function createStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        z-index: 99999;
        display: none;
        align-items: center;
        gap: 10px;
        padding: 12px 18px;
        border-radius: 16px;
        background: rgba(0, 0, 0, 0.88);
        color: #fff;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
        pointer-events: none;
        transform: translate(-50%, -100%) scale(0.92);
        opacity: 0;
        transition: opacity 0.22s ease, transform 0.22s ease;
      }
      #${OVERLAY_ID}.visible {
        display: flex;
        opacity: 1;
        transform: translate(-50%, -110%) scale(1);
      }
      #${OVERLAY_ID} .arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        font-size: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  function createOverlay() {
    if (overlayElement) return overlayElement;
    createStyles();

    overlayElement = document.createElement('div');
    overlayElement.id = OVERLAY_ID;
    overlayElement.innerHTML = `
      <span class="arrow">↑</span>
      <div>
        <div>Ir al segundo piso</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;">Cuerpo23: x=44.150001, y=2.900000, z=1.000000</div>
      </div>
    `;
    document.body.appendChild(overlayElement);
    return overlayElement;
  }

  function hideOverlay() {
    if (!overlayElement) return;
    overlayElement.classList.remove('visible');
    if (overlayTimer) {
      window.clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    overlayTimer = window.setTimeout(() => {
      if (overlayElement) {
        overlayElement.style.display = 'none';
      }
    }, 220);
  }

  function showOverlay(x, y) {
    const overlay = createOverlay();
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y - 16}px`;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
    if (overlayTimer) {
      window.clearTimeout(overlayTimer);
    }
    overlayTimer = window.setTimeout(hideOverlay, 3200);
  }

  function getComponent() {
    const appMap = document.querySelector('app-map3d');
    if (!appMap) return null;
    if (window.ng && typeof window.ng.getComponent === 'function') {
      try {
        return window.ng.getComponent(appMap);
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  function onCanvasClick(event) {
    if (event.button !== 0) return;
    const component = getComponent();
    if (!component || !component.scene || typeof component.scene.pick !== 'function') {
      return;
    }
    const pickResult = component.scene.pick(event.clientX, event.clientY);
    if (pickResult && pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.name === TARGET_MESH_NAME) {
      showOverlay(event.clientX, event.clientY);
    }
  }

  function attachCanvas(canvas) {
    if (!canvas || canvas.dataset.cuerpo23OverlayAttached === 'true') return;
    canvas.dataset.cuerpo23OverlayAttached = 'true';
    canvas.addEventListener('click', onCanvasClick);
  }

  function findCanvas() {
    const canvas = document.querySelector('app-map3d canvas');
    if (canvas) {
      canvasElement = canvas;
      attachCanvas(canvas);
      return true;
    }
    return false;
  }

  function observeDom() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!canvasElement || !document.body.contains(canvasElement)) {
        findCanvas();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (findCanvas()) {
      observeDom();
      return;
    }
    const interval = window.setInterval(() => {
      if (findCanvas()) {
        window.clearInterval(interval);
        observeDom();
      }
    }, 300);
  }

  window.addEventListener('load', init);
})();
