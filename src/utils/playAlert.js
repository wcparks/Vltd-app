export function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.15, 0.3].forEach((time, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600 + (i * 100);
      gain.gain.setValueAtTime(0.4, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.12);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.12);
    });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}
