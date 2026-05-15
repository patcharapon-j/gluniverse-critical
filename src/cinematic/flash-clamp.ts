const MAX_FLASHES_PER_SECOND = 3;

type SamplePoint = { t: number; luminance: number };

export class FlashClampMonitor {
  private samples: SamplePoint[] = [];
  private lastLuminance = 0;
  private clamped = false;

  sample(now: number, luminance: number): number {
    const delta = Math.abs(luminance - this.lastLuminance);
    if (delta > 0.5) this.samples.push({ t: now, luminance });
    this.lastLuminance = luminance;

    while (this.samples.length > 0) {
      const oldest = this.samples[0];
      if (oldest === undefined) break;
      if (now - oldest.t > 1000) this.samples.shift();
      else break;
    }

    if (this.samples.length > MAX_FLASHES_PER_SECOND) {
      this.clamped = true;
      return Math.min(luminance, 0.6);
    }
    return luminance;
  }

  wasClamped(): boolean {
    return this.clamped;
  }

  reset(): void {
    this.samples = [];
    this.lastLuminance = 0;
    this.clamped = false;
  }
}
