// Transient store for the learner's best (longest) spoken clip of the current
// session, used to give end-of-session pronunciation feedback. Cleared when a
// new session starts. Not persisted anywhere.

let _bestClip: Blob | null = null;
let _bestSize = 0;

/** Offer a recorded voice clip; the longest one of the session is kept. */
export function offerVoiceClip(blob: Blob): void {
  if (blob && blob.size > _bestSize) {
    _bestSize = blob.size;
    _bestClip = blob;
  }
}

export function takeVoiceClip(): Blob | null {
  return _bestClip;
}

export function clearVoiceClip(): void {
  _bestClip = null;
  _bestSize = 0;
}
