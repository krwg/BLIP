import { t } from './i18n.js';
import { getVoiceMediaStream } from './audio-capture.js';
import { createPixelToggle, createPixelHintIcon } from './settings-ui.js';

/**
 * @param {object} config
 * @param {(patch: object) => Promise<object>} saveConfig
 */
export function buildMicTestPanel(config, saveConfig) {
  const wrap = document.createElement('div');
  wrap.className = 'mic-test-panel';

  const titleRow = document.createElement('div');
  titleRow.className = 'settings-label-row';
  const title = document.createElement('h3');
  title.className = 'section-subtitle';
  title.dataset.i18n = 'settings.mic_test_title';
  title.textContent = t('settings.mic_test_title');
  titleRow.appendChild(title);
  titleRow.appendChild(createPixelHintIcon('settings.mic_test_hint'));
  wrap.appendChild(titleRow);

  const nsToggle = createPixelToggle({
    checked: config.noiseSuppression !== false,
    labelKey: 'settings.noise_suppression',
    onChange: async (checked) => {
      await saveConfig({ noiseSuppression: checked });
    },
  });
  wrap.appendChild(nsToggle.el);

  const gainLabel = document.createElement('label');
  gainLabel.className = 'settings-field-label';
  gainLabel.dataset.i18n = 'settings.mic_input_volume';
  gainLabel.textContent = t('settings.mic_input_volume');
  const gainRow = document.createElement('div');
  gainRow.className = 'mic-test-slider-row';
  const gainSlider = document.createElement('input');
  gainSlider.type = 'range';
  gainSlider.min = '0';
  gainSlider.max = '200';
  gainSlider.value = String(config.micInputGain ?? 100);
  const gainVal = document.createElement('span');
  gainVal.className = 'mic-test-slider-val';
  gainVal.textContent = `${gainSlider.value}%`;
  gainRow.appendChild(gainSlider);
  gainRow.appendChild(gainVal);
  wrap.appendChild(gainLabel);
  wrap.appendChild(gainRow);

  const meter = document.createElement('div');
  meter.className = 'mic-test-meter';
  const meterFill = document.createElement('div');
  meterFill.className = 'mic-test-meter-fill';
  meter.appendChild(meterFill);
  wrap.appendChild(meter);

  const actions = document.createElement('div');
  actions.className = 'mic-test-actions';
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.className = 'btn btn-accent';
  testBtn.dataset.i18n = 'settings.mic_test_start';
  testBtn.textContent = t('settings.mic_test_start');
  actions.appendChild(testBtn);
  wrap.appendChild(actions);

  let testStream = null;
  let testCtx = null;
  let testSrc = null;
  let testGain = null;
  let testDest = null;
  let meterRaf = null;
  let analyser = null;

  function stopTest() {
    if (meterRaf) cancelAnimationFrame(meterRaf);
    meterRaf = null;
    meterFill.style.width = '0%';
    testSrc?.disconnect();
    testGain?.disconnect();
    testDest?.disconnect();
    testStream?.getTracks().forEach((tr) => tr.stop());
    testStream = null;
    if (testCtx) {
      void testCtx.close().catch(() => {});
      testCtx = null;
    }
    testBtn.dataset.i18n = 'settings.mic_test_start';
    testBtn.textContent = t('settings.mic_test_start');
  }

  function tickMeter() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > peak) peak = data[i];
    }
    const pct = Math.min(100, Math.round((peak / 255) * 140));
    meterFill.style.width = `${pct}%`;
    meterRaf = requestAnimationFrame(tickMeter);
  }

  async function startTest() {
    stopTest();
    const live = {
      ...config,
      noiseSuppression: nsToggle.input.checked,
      micInputGain: Number(gainSlider.value),
    };
    try {
      testStream = await getVoiceMediaStream(live);
      testCtx = new AudioContext();
      testSrc = testCtx.createMediaStreamSource(testStream);
      testGain = testCtx.createGain();
      testGain.gain.value = Number(gainSlider.value) / 100;
      analyser = testCtx.createAnalyser();
      analyser.fftSize = 256;
      testDest = testCtx.createMediaStreamDestination();
      testSrc.connect(testGain);
      testGain.connect(analyser);
      analyser.connect(testDest);
      tickMeter();
      testBtn.dataset.i18n = 'settings.mic_test_stop';
      testBtn.textContent = t('settings.mic_test_stop');
    } catch (e) {
      console.warn('[mic-test]', e);
    }
  }

  testBtn.addEventListener('click', () => {
    if (testStream) stopTest();
    else void startTest();
  });

  gainSlider.addEventListener('input', () => {
    gainVal.textContent = `${gainSlider.value}%`;
    if (testGain) testGain.gain.value = Number(gainSlider.value) / 100;
  });
  gainSlider.addEventListener('change', async () => {
    await saveConfig({ micInputGain: Number(gainSlider.value) });
  });

  return { el: wrap, stop: stopTest };
}
