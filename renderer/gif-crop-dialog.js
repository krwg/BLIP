import { t } from './i18n.js';
import { computeGifFramePx } from './gif-frame-size.js';

const CROP_MAX_W = 400;
const CROP_MAX_H = 225;

export function openGifCropDialog(file) {
  const isGif =
    file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
  if (!isGif) return Promise.resolve(false);

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };
    img.onload = () => {
      const { w: VIEW_W, h: VIEW_H } = computeGifFramePx(
        img.width,
        img.height,
        CROP_MAX_W,
        CROP_MAX_H
      );

      let scale = Math.max(VIEW_W / img.width, VIEW_H / img.height);
      let offsetX = (VIEW_W - img.width * scale) / 2;
      let offsetY = (VIEW_H - img.height * scale) / 2;
      let dragging = false;
      let dragStart = { x: 0, y: 0, ox: 0, oy: 0 };

      const backdrop = document.createElement('div');
      backdrop.className = 'blip-modal-backdrop avatar-crop-backdrop';

      const modal = document.createElement('div');
      modal.className = 'blip-modal glass avatar-crop-modal gif-crop-modal';

      const title = document.createElement('h3');
      title.className = 'blip-modal-title';
      title.dataset.i18n = 'settings.profile_gif_crop_title';
      title.textContent = t('settings.profile_gif_crop_title');

      const frame = document.createElement('div');
      frame.className = 'avatar-crop-frame gif-crop-frame';
      frame.style.width = `${VIEW_W}px`;
      frame.style.height = `${VIEW_H}px`;

      const canvas = document.createElement('canvas');
      canvas.className = 'avatar-crop-canvas gif-crop-canvas';
      canvas.width = VIEW_W;
      canvas.height = VIEW_H;
      canvas.style.width = `${VIEW_W}px`;
      canvas.style.height = `${VIEW_H}px`;

      const overlay = document.createElement('div');
      overlay.className = 'avatar-crop-overlay gif-crop-overlay';
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
      const baseScale = scale;

      function clampOffsets() {
        const w = img.width * scale;
        const h = img.height * scale;
        offsetX = Math.min(0, Math.max(VIEW_W - w, offsetX));
        offsetY = Math.min(0, Math.max(VIEW_H - h, offsetY));
      }

      function draw() {
        ctx.clearRect(0, 0, VIEW_W, VIEW_H);
        ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
      }

      draw();

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

      zoom.addEventListener('input', () => {
        const centerX = offsetX + (img.width * scale) / 2;
        const centerY = offsetY + (img.height * scale) / 2;
        scale = baseScale * (Number(zoom.value) / 100);
        offsetX = centerX - (img.width * scale) / 2;
        offsetY = centerY - (img.height * scale) / 2;
        clampOffsets();
        draw();
      });

      const actions = document.createElement('div');
      actions.className = 'blip-modal-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-lang';
      cancelBtn.textContent = t('dialog.cancel');

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn btn-accent';
      okBtn.textContent = t('dialog.confirm');

      let done = false;
      function finish(confirmed) {
        if (done) return;
        done = true;
        URL.revokeObjectURL(objectUrl);
        backdrop.remove();
        resolve(!!confirmed);
      }

      cancelBtn.addEventListener('click', () => finish(false));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) finish(false);
      });

      okBtn.addEventListener('click', () => finish(true));

      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      modal.appendChild(title);
      modal.appendChild(frame);
      modal.appendChild(zoomLabel);
      modal.appendChild(zoomRow);
      modal.appendChild(actions);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      okBtn.focus();
    };
    img.src = objectUrl;
  });
}
