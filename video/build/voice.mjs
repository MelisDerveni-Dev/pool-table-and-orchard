// Generates the narration beat by beat with HyperFrames' local TTS (Kokoro),
// measures every beat, and assembles one voice track with fixed pauses.
// Output: assets/vo/<scene>_<n>.wav, assets/vo/voice.wav, build/timing.json
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const script = JSON.parse(readFileSync(join(ROOT, 'script.json'), 'utf8'));
const VO = join(ROOT, 'assets', 'vo');
mkdirSync(VO, { recursive: true });

const LEAD = 0.8, GAP = 0.45, TAIL = 1.1;   // seconds of silence: scene start, between beats, scene end
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }).toString();
const dur = f => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

const timing = { lead: LEAD, gap: GAP, tail: TAIL, scenes: [] };
let t = 0; const parts = [];
const silence = s => { const f = join(VO, `sil_${Math.round(s * 1000)}.wav`); if (!existsSync(f)) sh('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(s), '-c:a', 'pcm_s16le', f]); return f; };

for (const sc of script.scenes) {
  const scene = { id: sc.id, start: +t.toFixed(3), beats: [] };
  parts.push(silence(LEAD)); let local = LEAD;
  sc.beats.forEach((b, i) => {
    const f = join(VO, `${sc.id}_${i + 1}.wav`);
    if (!existsSync(f)) {
      sh('npx', ['-y', 'hyperframes@0.9.91', 'tts', JSON.stringify(b.say), '-v', script.voice, '-s', String(script.speed), '-o', f]);
      console.log('tts', sc.id, i + 1);
    }
    // normalise every beat to the same format so concat is exact
    const g = f.replace(/\.wav$/, '.n.wav');
    sh('ffmpeg', ['-y', '-v', 'error', '-i', f, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', g]);
    const d = dur(g);
    scene.beats.push({ i: i + 1, start: +local.toFixed(3), dur: +d.toFixed(3), say: b.say });
    parts.push(g); local += d;
    if (i < sc.beats.length - 1) { parts.push(silence(GAP)); local += GAP; }
  });
  parts.push(silence(TAIL)); local += TAIL;
  scene.dur = +local.toFixed(3); t += local;
  timing.scenes.push(scene);
}
timing.total = +t.toFixed(3);
const list = join(VO, 'concat.txt');
writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
sh('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', join(VO, 'voice.wav')]);
writeFileSync(join(ROOT, 'build', 'timing.json'), JSON.stringify(timing, null, 2));
console.log('total seconds', timing.total, 'measured', dur(join(VO, 'voice.wav')));
