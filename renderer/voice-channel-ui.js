import { t } from './i18n.js';
import { createAvatarElement } from './avatar.js';
import {
  getParticipantMediaState,
  isInVoiceChannel,
  getActiveVoiceChannel,
  toggleVoiceMute,
  toggleVoiceDeafen,
  isVoiceMuted,
  isVoiceDeafened,
  leaveVoiceChannel,
  registerVoiceStageRefresh,
  toggleVoiceScreenShare,
  isVoiceScreenSharing,
  getPeerVideoStream,
  getLocalScreenPreview,
} from './voice-channel.js';
import { getVoiceChannelRoster } from './voice-channel-roster.js';

export function createVoiceStage(config, groupId, channelId) {
  const wrap = document.createElement('div');
  wrap.className = 'voice-stage glass hidden';

  const head = document.createElement('div');
  head.className = 'voice-stage-head';

  const indicator = document.createElement('span');
  indicator.className = 'voice-stage-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const headText = document.createElement('div');
  headText.className = 'voice-stage-head-text';

  const title = document.createElement('span');
  title.className = 'voice-stage-title';
  title.dataset.i18n = 'voice.stage_title';
  title.textContent = t('voice.stage_title');

  const status = document.createElement('span');
  status.className = 'voice-stage-status';

  headText.appendChild(title);
  headText.appendChild(status);
  head.appendChild(indicator);
  head.appendChild(headText);

  const grid = document.createElement('div');
  grid.className = 'voice-stage-grid';
  grid.setAttribute('role', 'list');

  const controls = document.createElement('div');
  controls.className = 'voice-stage-controls';

  const toolbar = document.createElement('div');
  toolbar.className = 'voice-stage-toolbar';

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'btn btn-lang voice-ctrl-btn';
  muteBtn.dataset.i18n = 'call.mute';
  muteBtn.textContent = t('call.mute');

  const deafBtn = document.createElement('button');
  deafBtn.type = 'button';
  deafBtn.className = 'btn btn-lang voice-ctrl-btn';
  deafBtn.dataset.i18n = 'call.deafen';
  deafBtn.textContent = t('call.deafen');

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'btn btn-lang voice-ctrl-btn';
  shareBtn.dataset.i18n = 'call.share';
  shareBtn.textContent = t('call.share');

  const leaveBtn = document.createElement('button');
  leaveBtn.type = 'button';
  leaveBtn.className = 'btn btn-danger voice-ctrl-btn voice-ctrl-leave';
  leaveBtn.dataset.i18n = 'voice.leave';
  leaveBtn.textContent = t('voice.leave');

  toolbar.appendChild(muteBtn);
  toolbar.appendChild(deafBtn);
  toolbar.appendChild(shareBtn);
  controls.appendChild(toolbar);
  controls.appendChild(leaveBtn);

  wrap.appendChild(head);
  wrap.appendChild(grid);
  wrap.appendChild(controls);

  muteBtn.addEventListener('click', () => {
    void toggleVoiceMute().then(refresh);
  });
  deafBtn.addEventListener('click', () => {
    void toggleVoiceDeafen().then(refresh);
  });
  shareBtn.addEventListener('click', () => {
    void toggleVoiceScreenShare().then(refresh);
  });
  leaveBtn.addEventListener('click', () => {
    void leaveVoiceChannel().then(() => {
      wrap.classList.add('hidden');
      refresh();
    });
  });

  function refresh() {
    const active = getActiveVoiceChannel();
    const inThis =
      active?.groupId === groupId && active?.channelId === channelId && isInVoiceChannel();
    wrap.classList.toggle('hidden', !inThis);
    wrap.classList.toggle('voice-stage--connected', inThis);

    if (!inThis) return;

    const snap = getVoiceChannelRoster(groupId, channelId);
    status.textContent = t('voice.in_channel').replace('{n}', String(snap.count));

    muteBtn.classList.toggle('active', isVoiceMuted());
    muteBtn.dataset.i18n = isVoiceMuted() ? 'call.unmute' : 'call.mute';
    muteBtn.textContent = t(isVoiceMuted() ? 'call.unmute' : 'call.mute');

    deafBtn.classList.toggle('active', isVoiceDeafened());
    deafBtn.dataset.i18n = isVoiceDeafened() ? 'call.undeafen' : 'call.deafen';
    deafBtn.textContent = t(isVoiceDeafened() ? 'call.undeafen' : 'call.deafen');

    shareBtn.classList.toggle('active', isVoiceScreenSharing());

    const ids = [...new Set(snap.participants.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
    grid.innerHTML = '';
    if (!ids.length) {
      const empty = document.createElement('p');
      empty.className = 'hint voice-stage-empty';
      empty.dataset.i18n = 'voice.stage_empty';
      empty.textContent = t('voice.stage_empty');
      grid.appendChild(empty);
      return;
    }
    const selfId = Number(config.blipId);
    ids.forEach((pid) => {
      const n = Number(pid);
      const isSelf = n === selfId;
      const tile = document.createElement('div');
      tile.className = `voice-tile glass${isSelf ? ' voice-tile--self' : ''}`;
      tile.setAttribute('role', 'listitem');

      const slot = document.createElement('div');
      slot.className = 'voice-tile-slot voice-tile-frame';
      const preview =
        n === selfId ? getLocalScreenPreview() : getPeerVideoStream(n);
      if (preview?.getVideoTracks?.()?.[0]) {
        const vid = document.createElement('video');
        vid.className = 'voice-tile-video';
        vid.autoplay = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.srcObject = preview;
        vid.addEventListener('click', () => {
          const overlay = document.createElement('div');
          overlay.className = 'voice-stream-fs';
          const full = document.createElement('video');
          full.autoplay = true;
          full.muted = true;
          full.playsInline = true;
          full.srcObject = preview;
          const close = document.createElement('button');
          close.type = 'button';
          close.className = 'btn btn-accent voice-stream-fs-close';
          close.textContent = t('call.exit_stream');
          close.addEventListener('click', () => overlay.remove());
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
          });
          overlay.appendChild(full);
          overlay.appendChild(close);
          document.body.appendChild(overlay);
        });
        slot.appendChild(vid);
      } else {
        slot.appendChild(createAvatarElement(n, 4, { selfBlipId: config.blipId }));
      }
      tile.appendChild(slot);

      const media = getParticipantMediaState(n);
      const badges = document.createElement('div');
      badges.className = 'voice-tile-badges';
      if (media.muted) {
        const b = document.createElement('span');
        b.className = 'call-peer-badge call-peer-badge--mic';
        b.textContent = t('call.remote_muted');
        badges.appendChild(b);
      }
      if (media.deafened) {
        const b = document.createElement('span');
        b.className = 'call-peer-badge call-peer-badge--deaf';
        b.textContent = t('call.remote_deaf');
        badges.appendChild(b);
      }
      if (media.screenSharing) {
        const b = document.createElement('span');
        b.className = 'call-peer-badge';
        b.textContent = t('call.share');
        badges.appendChild(b);
      }
      if (badges.childElementCount) tile.appendChild(badges);

      const lbl = document.createElement('span');
      lbl.className = 'voice-tile-label';
      lbl.textContent = isSelf ? t('group.you') : `#${n}`;
      tile.appendChild(lbl);
      grid.appendChild(tile);
    });
  }

  registerVoiceStageRefresh(refresh);

  const onVoiceState = (ev) => {
    if (ev.detail?.groupId === groupId && ev.detail?.channelId === channelId) refresh();
  };
  window.addEventListener('blip-voice-channel-state', onVoiceState);

  return {
    el: wrap,
    refresh,
    destroy() {
      window.removeEventListener('blip-voice-channel-state', onVoiceState);
      registerVoiceStageRefresh(null);
    },
  };
}
