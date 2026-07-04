
export function createBeaconPixelIcon(className = 'beacon-pixel-icon') {
  const el = document.createElement('span');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function createBeaconHeroTower() {
  const wrap = document.createElement('div');
  wrap.className = 'beacon-hero-tower';
  wrap.appendChild(createBeaconPixelIcon('beacon-pixel-icon beacon-pixel-icon--hero'));
  const beam = document.createElement('span');
  beam.className = 'beacon-hero-beam';
  beam.setAttribute('aria-hidden', 'true');
  wrap.appendChild(beam);
  return wrap;
}
