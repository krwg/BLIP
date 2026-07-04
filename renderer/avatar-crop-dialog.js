import { t } from './i18n.js';

const VIEW_SIZE = 280;
const OUTPUT_SIZE = 128;

export function openAvatarCropDialog(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        let scale = Math.max(VIEW_SIZE / img.width, VIEW_SIZE / img.height);
        let offsetX = (VIEW_SIZE - img.width * scale) / 2;
        let offsetY = (VIEW_SIZE - img.height * scale) / 2;
        let dragging = false;
        let dragStart = { x: 0, y: 0, ox: 0, oy: 0 };

        const backdrop = document.createElement('div');
        backdrop.className = 'blip-modal-backdrop avatar-crop-backdrop';

        const modal = document.createElement('div');
        modal.className = 'blip-modal glass avatar-crop-modal';

        const title = document.createElement('h3');
        title.className = 'blip-modal-title';
        title.dataset.i18n = 'settings.avatar_crop_title';
        title.textContent = t('settings.avatar_crop_title');

        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.dataset.i18n = 'settings.avatar_crop_hint';
        hint.textContent = t('settings.avatar_crop_hint');

        const frame = document.createElement('div');
        frame.className = 'avatar-crop-frame';

        const canvas = document.createElement('canvas');
        canvas.className = 'avatar-crop-canvas';
        canvas.width = VIEW_SIZE;
        canvas.height = VIEW_SIZE;

        const overlay = document.createElement('div');
        overlay.className = 'avatar-crop-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        frame.appendChild(canvas);
        frame.appendChild(overlay);

        const zoomLabel = document.createElement('label');
        zoomLabel.className = 'settings-field-label';
        zoomLabel.dataset.i18n = 'settings.avatar_crop_zoom';
        zoomLabel.textContent = t('settings.avatar_crop_zoom');
        const zoomRow = document.createElement('div');
        zoomRow.className = 'avatar-crop-zoom-row';
        const zoom = document.createElement('input');
        zoom.type = 'range';
        zoom.min = '100';
        zoom.max = '300';
        zoom.value = '100';
        zoomRow.appendChild(zoom);

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        function clampOffsets() {
          const w = img.width * scale;
          const h = img.height * scale;
          const minX = VIEW_SIZE - w;
          const minY = VIEW_SIZE - h;
          offsetX = Math.min(0, Math.max(minX, offsetX));
          offsetY = Math.min(0, Math.max(minY, offsetY));
        }

        function draw() {
          ctx.fillStyle = '#0a0a0a';
          ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);
          ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
        }

        function applyZoom(pct) {
          const centerX = VIEW_SIZE / 2;
          const centerY = VIEW_SIZE / 2;
          const imgX = (centerX - offsetX) / scale;
          const imgY = (centerY - offsetY) / scale;
          const base = Math.max(VIEW_SIZE / img.width, VIEW_SIZE / img.height);
          scale = base * (Number(pct) / 100);
          offsetX = centerX - imgX * scale;
          offsetY = centerY - imgY * scale;
          clampOffsets();
          draw();
        }

        zoom.addEventListener('input', () => applyZoom(zoom.value));

        canvas.addEventListener('mousedown', (e) => {
          dragging = true;
          dragStart = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
        });
        window.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          offsetX = dragStart.ox + (e.clientX - dragStart.x);
          offsetY = dragStart.oy + (e.clientY - dragStart.y);
          clampOffsets();
          draw();
        });
        window.addEventListener('mouseup', () => {
          dragging = false;
        });

        function exportCrop() {
          const out = document.createElement('canvas');
          out.width = OUTPUT_SIZE;
          out.height = OUTPUT_SIZE;
          const octx = out.getContext('2d');
          octx.imageSmoothingEnabled = false;
          octx.drawImage(canvas, 0, 0, VIEW_SIZE, VIEW_SIZE, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
          let quality = 0.9;
          let url = out.toDataURL('image/jpeg', quality);
          while (url.length > 52000 && quality > 0.35) {
            quality -= 0.1;
            url = out.toDataURL('image/jpeg', quality);
          }
          return url.length <= 64000 ? url : null;
        }

        const actions = document.createElement('div');
        actions.className = 'blip-modal-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-lang';
        cancelBtn.dataset.i18n = 'dialog.cancel';
        cancelBtn.textContent = t('dialog.cancel');
        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn btn-accent';
        okBtn.dataset.i18n = 'settings.avatar_crop_save';
        okBtn.textContent = t('settings.avatar_crop_save');

        let done = false;
        function finish(v) {
          if (done) return;
          done = true;
          backdrop.remove();
          resolve(v);
        }

        cancelBtn.addEventListener('click', () => finish(null));
        okBtn.addEventListener('click', () => finish(exportCrop()));
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) finish(null);
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        modal.appendChild(title);
        modal.appendChild(hint);
        modal.appendChild(frame);
        modal.appendChild(zoomLabel);
        modal.appendChild(zoomRow);
        modal.appendChild(actions);
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        applyZoom(100);
        zoom.focus();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
