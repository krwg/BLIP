
export function getVoiceAudioConstraints(config) {
  const deviceId = config?.audioInputDeviceId;
  const base = {
    echoCancellation: true,
    noiseSuppression: config?.noiseSuppression !== false,
    autoGainControl: config?.autoGainControl !== false,
  };
  if (deviceId && deviceId !== 'default') {
    return { deviceId: { exact: deviceId }, ...base };
  }
  return base;
}

export async function getVoiceMediaStream(config) {
  const audio = getVoiceAudioConstraints(config);
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video: false });
  } catch (err) {
    if (!config?.audioInputDeviceId) throw err;
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: config?.noiseSuppression !== false,
        autoGainControl: config?.autoGainControl !== false,
      },
      video: false,
    });
  }
}
