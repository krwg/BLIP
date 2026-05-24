const { contextBridge, ipcRenderer, webUtils } = require('electron');

let groupCallActive = false;
let groupCallGroupId = null;

const trustStateLive = {
  buildTrust: 'unverified_build',
  meshPlusTrust: 'unverified_mesh_plus',
};

ipcRenderer.invoke('get-trust-state').then((t) => {
  if (t && typeof t === 'object') Object.assign(trustStateLive, t);
});

ipcRenderer.on('trust-state', (_, t) => {
  if (t && typeof t === 'object') Object.assign(trustStateLive, t);
});

contextBridge.exposeInMainWorld('trustState', trustStateLive);

contextBridge.exposeInMainWorld('blip', {
  platform: process.platform,
  getTrustState: () => ipcRenderer.invoke('get-trust-state'),
  onTrustState: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('trust-state', handler);
    return () => ipcRenderer.removeListener('trust-state', handler);
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  activateMeshPlus: (key) => ipcRenderer.invoke('activate-mesh-plus', key),
  deactivateMeshPlus: () => ipcRenderer.invoke('deactivate-mesh-plus'),
  factoryReset: () => ipcRenderer.invoke('factory-reset'),
  getMeshPlusStatus: () => ipcRenderer.invoke('get-mesh-plus-status'),
  getAppMetadata: () => ipcRenderer.invoke('get-app-metadata'),
  getAppIconUrl: () => ipcRenderer.invoke('get-app-icon-url'),
  getAppIconVariants: () => ipcRenderer.invoke('get-app-icon-variants'),
  isVoiceCallActive: () => ipcRenderer.invoke('is-voice-call-active'),
  getAvatarDataUrl: () => ipcRenderer.invoke('get-avatar-data-url'),
  saveAvatar: (dataUrl) => ipcRenderer.invoke('save-avatar', dataUrl),
  clearAvatar: () => ipcRenderer.invoke('clear-avatar'),
  getProfileGifActiveUrl: () => ipcRenderer.invoke('get-profile-gif-active-url'),
  getProfileGifShareUrl: () => ipcRenderer.invoke('get-profile-gif-share-url'),
  getProfileGifHistory: () => ipcRenderer.invoke('get-profile-gif-history'),
  saveProfileGif: (dataUrl) => ipcRenderer.invoke('save-profile-gif', dataUrl),
  saveProfileGifBytes: (base64) => ipcRenderer.invoke('save-profile-gif-bytes', base64),
  saveProfileGifPath: (filePath) => ipcRenderer.invoke('save-profile-gif-path', filePath),
  setProfileGifActive: (id) => ipcRenderer.invoke('set-profile-gif-active', id),
  clearProfileGif: () => ipcRenderer.invoke('clear-profile-gif'),
  isGiphyConfigured: () => ipcRenderer.invoke('is-giphy-configured'),
  searchGiphy: (q, offset) => ipcRenderer.invoke('search-giphy', q, offset),
  trendingGiphy: (offset) => ipcRenderer.invoke('trending-giphy', offset),
  importGiphyGif: (url) => ipcRenderer.invoke('import-giphy-gif', url),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  listDisplaySources: () => ipcRenderer.invoke('list-display-sources'),
  prepareDisplayCapture: (sourceId) => ipcRenderer.invoke('prepare-display-capture', sourceId),
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getNetworkDiagnostics: () => ipcRenderer.invoke('get-network-diagnostics'),
  getGithubReleases: (limit) => ipcRenderer.invoke('get-github-releases', limit),
  sendTcpMessage: (payload) => ipcRenderer.invoke('send-tcp-message', payload),
  initiateCall: (payload) => ipcRenderer.invoke('initiate-call', payload),
  callAccept: (payload) => ipcRenderer.invoke('call-accept', payload),
  callReject: (payload) => ipcRenderer.invoke('call-reject', payload),
  callCandidate: (payload) => ipcRenderer.invoke('call-candidate', payload),
  callHangup: (payload) => ipcRenderer.invoke('call-hangup', payload),
  callState: (payload) => ipcRenderer.invoke('call-state', payload),
  callRenegotiate: (payload) => ipcRenderer.invoke('call-renegotiate', payload),
  callRenegotiateAnswer: (payload) => ipcRenderer.invoke('call-renegotiate-answer', payload),
  pingPeer: (blipId) => ipcRenderer.invoke('ping-peer', blipId),
  checkIdConflict: (blipId) => ipcRenderer.invoke('check-id-conflict', blipId),
  openCallOutgoing: (payload) => ipcRenderer.invoke('open-call-outgoing', payload),
  closeCallWindow: () => ipcRenderer.invoke('close-call-window'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  showMessageNotification: (payload) => ipcRenderer.invoke('show-message-notification', payload),
  onUpdateStatus: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  onPeersUpdated: (cb) => {
    const handler = (_, peers) => cb(peers);
    ipcRenderer.on('peers-updated', handler);
    return () => ipcRenderer.removeListener('peers-updated', handler);
  },
  onTcpMessage: (cb) => {
    const handler = (_, msg) => cb(msg);
    ipcRenderer.on('tcp-message', handler);
    return () => ipcRenderer.removeListener('tcp-message', handler);
  },
  onSeedUdp: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('seed-udp', handler);
    return () => ipcRenderer.removeListener('seed-udp', handler);
  },
  beaconSendUdp: (payload) => ipcRenderer.invoke('beacon-udp-send', payload),
  getBeaconPaths: () => ipcRenderer.invoke('beacon-paths'),
  beaconPickPublishFile: () => ipcRenderer.invoke('beacon-pick-publish-file'),
  getPathForFile: (file) => {
    try {
      if (file && typeof webUtils?.getPathForFile === 'function') {
        return webUtils.getPathForFile(file) || '';
      }
    } catch {
      /* ignore */
    }
    if (file && typeof file.path === 'string') return file.path;
    return '';
  },
  beaconPublishFromPath: (payload) => ipcRenderer.invoke('beacon-publish-from-path', payload),
  beaconServeChunksTcp: (payload) => ipcRenderer.invoke('beacon-serve-chunks-tcp', payload),
  sendFileFromPath: (payload) => ipcRenderer.invoke('send-file-from-path', payload),
  onFileSendProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('file-send-progress', handler);
    return () => ipcRenderer.removeListener('file-send-progress', handler);
  },
  onBeaconIngestProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('beacon-ingest-progress', handler);
    return () => ipcRenderer.removeListener('beacon-ingest-progress', handler);
  },
  beaconWriteMeta: (payload) => ipcRenderer.invoke('beacon-write-meta', payload),
  beaconReadMeta: (payload) => ipcRenderer.invoke('beacon-read-meta', payload),
  beaconReadPreview: (payload) => ipcRenderer.invoke('beacon-read-preview', payload),
  beaconWritePreview: (payload) => ipcRenderer.invoke('beacon-write-preview', payload),
  setTrayTransferProgress: (info) => ipcRenderer.invoke('set-tray-transfer-progress', info),
  beaconWriteChunk: (payload) => ipcRenderer.invoke('beacon-write-chunk', payload),
  beaconWriteChunksBatch: (payload) => ipcRenderer.invoke('beacon-write-chunks-batch', payload),
  beaconReadChunk: (payload) => ipcRenderer.invoke('beacon-read-chunk', payload),
  beaconReadChunksBatch: (payload) => ipcRenderer.invoke('beacon-read-chunks-batch', payload),
  beaconHaveBitmap: (payload) => ipcRenderer.invoke('beacon-have-bitmap', payload),
  beaconChunkExists: (payload) => ipcRenderer.invoke('beacon-chunk-exists', payload),
  beaconCountChunks: (payload) => ipcRenderer.invoke('beacon-count-chunks', payload),
  beaconListLocal: () => ipcRenderer.invoke('beacon-list-local'),
  beaconSaveAssembled: (payload) => ipcRenderer.invoke('beacon-save-assembled', payload),
  beaconDeleteSeed: (payload) => ipcRenderer.invoke('beacon-delete-seed', payload),
  beaconSeedExists: (payload) => ipcRenderer.invoke('beacon-seed-exists', payload),
  beaconReadBlipFile: (payload) => ipcRenderer.invoke('beacon-read-blip-file', payload),
  onBeaconOpenSeed: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('beacon-open-seed', handler);
    return () => ipcRenderer.removeListener('beacon-open-seed', handler);
  },
  onBeaconOpenBlipFile: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('beacon-open-blip-file', handler);
    return () => ipcRenderer.removeListener('beacon-open-blip-file', handler);
  },
  onNotificationOpenChat: (cb) => {
    const handler = (_, peerId) => cb(peerId);
    ipcRenderer.on('notification-open-chat', handler);
    return () => ipcRenderer.removeListener('notification-open-chat', handler);
  },
  onIncomingCall: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('incoming-call', handler);
    return () => ipcRenderer.removeListener('incoming-call', handler);
  },
  onCallOutgoing: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-outgoing', handler);
    return () => ipcRenderer.removeListener('call-outgoing', handler);
  },
  onCallAnswer: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-answer', handler);
    return () => ipcRenderer.removeListener('call-answer', handler);
  },
  onCallCandidate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-candidate', handler);
    return () => ipcRenderer.removeListener('call-candidate', handler);
  },
  onCallRejected: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-rejected', handler);
    return () => ipcRenderer.removeListener('call-rejected', handler);
  },
  onCallEnded: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-ended', handler);
    return () => ipcRenderer.removeListener('call-ended', handler);
  },
  onCallState: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-state', handler);
    return () => ipcRenderer.removeListener('call-state', handler);
  },
  onCallRenegotiate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-renegotiate', handler);
    return () => ipcRenderer.removeListener('call-renegotiate', handler);
  },
  onCallRenegotiateAnswer: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('call-renegotiate-answer', handler);
    return () => ipcRenderer.removeListener('call-renegotiate-answer', handler);
  },
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  callWindowMinimize: () => ipcRenderer.send('call-window-minimize'),
  callWindowMaximize: () => ipcRenderer.send('call-window-maximize'),
  callWindowClose: () => ipcRenderer.send('call-window-close'),
  callWindowToggleFullScreen: () => ipcRenderer.invoke('call-window-toggle-fullscreen'),
  callWindowIsFullScreen: () => ipcRenderer.invoke('call-window-is-fullscreen'),
  onConfigUpdated: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('config-updated', handler);
    return () => ipcRenderer.removeListener('config-updated', handler);
  },
  onGlobalNavigate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('global-navigate', handler);
    return () => ipcRenderer.removeListener('global-navigate', handler);
  },
  onGlobalToggleDnd: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('global-toggle-dnd', handler);
    return () => ipcRenderer.removeListener('global-toggle-dnd', handler);
  },
  onGlobalHangup: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('global-hangup', handler);
    return () => ipcRenderer.removeListener('global-hangup', handler);
  },
  openGroupCall: (payload) => ipcRenderer.invoke('open-group-call', payload),
  openGroupCallIncoming: (payload) => ipcRenderer.invoke('open-group-call-incoming', payload),
  leaveGroupCall: () => ipcRenderer.invoke('leave-group-call'),
  closeGroupCallWindow: () => ipcRenderer.invoke('close-group-call-window'),
  reportGroupCallActive: (data) => ipcRenderer.send('group-call-active', data),
  syncGroupCallRoster: (data) => ipcRenderer.send('sync-group-call-roster', data),
  onGroupCallRosterSync: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('group-call-roster-sync', handler);
    return () => ipcRenderer.removeListener('group-call-roster-sync', handler);
  },
  isGroupCallActiveSync: () => groupCallActive,
  getActiveGroupCallIdSync: () => groupCallGroupId,
  onGroupCallActive: (cb) => {
    const handler = (_, data) => {
      groupCallActive = !!data?.active;
      groupCallGroupId = data?.groupId ?? null;
      cb(data);
    };
    ipcRenderer.on('group-call-active', handler);
    return () => ipcRenderer.removeListener('group-call-active', handler);
  },
  onGroupCallJoin: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('group-call-join', handler);
    return () => ipcRenderer.removeListener('group-call-join', handler);
  },
  onGroupCallIncoming: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('group-call-incoming', handler);
    return () => ipcRenderer.removeListener('group-call-incoming', handler);
  },
  onGroupCallTcp: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('group-call-tcp', handler);
    return () => ipcRenderer.removeListener('group-call-tcp', handler);
  },
  onGroupCallLeave: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('group-call-leave', handler);
    return () => ipcRenderer.removeListener('group-call-leave', handler);
  },
  groupCallWindowMinimize: () => ipcRenderer.send('group-call-window-minimize'),
  groupCallWindowMaximize: () => ipcRenderer.send('group-call-window-maximize'),
  groupCallWindowClose: () => ipcRenderer.send('group-call-window-close'),
  reportCallWindowReady: () => ipcRenderer.send('call-window-ready'),
  reportGroupCallWindowReady: () => ipcRenderer.send('group-call-window-ready'),
  getGroupForCall: (groupId) => ipcRenderer.invoke('get-group-for-call', groupId),
});
