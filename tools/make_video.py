"""9:16 walkthrough video of the app (1080x1920), in the Copperline light look.

Records preview.html (fake Send, saves nothing) with Chrome's screencast at 2x CSS zoom,
then lays the recording out with captions and a CC0 guitar bed.
Usage: node tools/build_preview.js && python3 tools/make_video.py
Output: video/resident-safety-9x16.mp4
"""
import base64
import json
import os
import subprocess
import tempfile
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(HERE, 'preview.html')
OUT = os.path.join(HERE, 'video', 'resident-safety-9x16.mp4')
FONT = os.path.expanduser('~/Documents/fabric-field-notes/tools/fonts/Archivo.ttf')
MUSIC = os.path.expanduser('~/Documents/linkedin-video/shared/music/happy-acoustic-guitar.mp3')  # CC0, Freesound 713738
ZOOM, W, H = 2, 390, 692          # app viewport in CSS px; frames come out at 780x1384
APP_W, APP_X, APP_Y = 880, 100, 270
END_HOLD = 3.5                    # seconds the last frame holds for the end card

# One caption per stretch between marks. No dashes and no ", and" joins (house style).
CAPTIONS = [
    ('home', 'Something unsafe here?', 'Report it in under a minute'),
    ('contacts', 'Help is one tap away', '112, fire, ambulance, gas, power or lifts'),
    ('lang', 'Works in 11 languages', 'English, Hindi, Kannada, Odia and more'),
    ('report', 'Pick what is wrong', 'Lifts, fire, gas, wiring, cracks, security'),
    ('urgent', 'Lift stuck? Help first', 'Call buttons come before any questions'),
    ('where', 'Tap the tower', 'No login. No name needed.'),
    ('details', 'Say what happened', 'Type it, record a voice note or add a photo'),
    ('send', 'Logged in seconds', 'Saved to the safety log with a ticket'),
    ('done', 'Share it with the safety group', 'One tap opens WhatsApp with the report'),
    ('end', 'Look for the QR in your lift', "A residents' initiative. Not an official society app."),
]

RIPPLE = """
document.addEventListener('pointerdown', e => {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;
    border-radius:50%;background:rgba(78,121,167,.35);pointer-events:none;z-index:99999;
    transition:transform .45s ease-out,opacity .45s ease-out`;
  document.body.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = 'scale(1.8)'; d.style.opacity = '0'; });
  setTimeout(() => d.remove(), 500);
}, true);
"""


def wheel(page, px, steps=10, pause=60):
    for _ in range(steps):
        page.mouse.wheel(0, px * ZOOM / steps)
        page.wait_for_timeout(pause)


def walkthrough(page, mark):
    mark('home')
    page.goto(PAGE)
    page.wait_for_timeout(2800)
    mark('contacts')
    wheel(page, 420, steps=14, pause=70)
    page.wait_for_timeout(1400)
    wheel(page, -420, steps=10, pause=50)
    page.wait_for_timeout(500)
    mark('lang')
    for code in ['hi', 'kn', 'or', 'ta', 'en']:
        page.select_option('#lang', code)
        page.wait_for_timeout(850)
    mark('report')
    page.click('#nextBtn')
    page.wait_for_timeout(1300)
    wheel(page, 320, steps=10, pause=70)
    page.wait_for_timeout(700)
    wheel(page, -320, steps=8, pause=50)
    page.wait_for_timeout(500)
    mark('urgent')
    page.click('.tile >> nth=0')
    page.wait_for_timeout(3000)
    mark('where')
    page.locator('#towerGrid').evaluate("el => el.scrollIntoView({behavior: 'smooth', block: 'center'})")
    page.wait_for_timeout(1100)
    page.click('.tower >> nth=2')
    page.wait_for_timeout(500)
    page.click('#spot')
    page.keyboard.type('Lift 2, between floors 9 and 10', delay=55)
    page.wait_for_timeout(500)
    page.click('#nextBtn')
    mark('details')
    page.wait_for_timeout(600)
    page.click('#description')
    page.keyboard.type('Stuck in lift 2 with my son. Alarm button gets no answer from the gate.', delay=28)
    page.wait_for_timeout(800)
    page.click('#nextBtn')
    mark('send')
    page.wait_for_timeout(1000)
    page.click('.consent')
    page.wait_for_timeout(700)
    page.click('#nextBtn')
    page.wait_for_timeout(600)
    mark('done')
    page.wait_for_timeout(1200)
    page.hover('#waShare')
    page.wait_for_timeout(2600)


def record(frames_dir):
    stamps, marks = [], {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': W * ZOOM, 'height': H * ZOOM}, locale='en', has_touch=False)
        ctx.add_init_script(f"document.addEventListener('DOMContentLoaded',()=>document.documentElement.style.zoom='{ZOOM}')")
        ctx.add_init_script(RIPPLE)
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)

        def on_frame(ev):
            with open(os.path.join(frames_dir, f'{len(stamps):05d}.jpg'), 'wb') as f:
                f.write(base64.b64decode(ev['data']))
            stamps.append(ev['metadata']['timestamp'])
            cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})

        cdp.on('Page.screencastFrame', on_frame)
        cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': W * ZOOM,
                                          'maxHeight': H * ZOOM, 'everyNthFrame': 1})
        walkthrough(page, lambda name: marks.__setitem__(name, time.time()))
        page.wait_for_timeout(300)
        cdp.send('Page.stopScreencast')
        browser.close()
    t0 = stamps[0]
    return [t - t0 for t in stamps], {k: max(0.0, v - t0) for k, v in marks.items()}


def frames_to_clip(frames_dir, ts, clip):
    lines = ['ffconcat version 1.0']
    for i, t in enumerate(ts):
        nxt = ts[i + 1] if i + 1 < len(ts) else t + 1 / 30
        lines += [f"file '{os.path.join(frames_dir, f'{i:05d}.jpg')}'", f'duration {max(nxt - t, 0.001):.4f}']
    lines.append(f"file '{os.path.join(frames_dir, f'{len(ts) - 1:05d}.jpg')}'")
    listfile = os.path.join(frames_dir, 'list.ffconcat')
    open(listfile, 'w').write('\n'.join(lines))
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listfile,
                    '-vf', f'fps=30,tpad=stop_mode=clone:stop_duration={END_HOLD}', '-pix_fmt', 'yuv420p', clip], check=True)


def compose(clip, marks, rec_len, tmp):
    total = rec_len + END_HOLD
    times = [marks[name] for name, _, _ in CAPTIONS[:-1]] + [rec_len]
    spans = [(times[i], times[i + 1] if i + 1 < len(times) else total) for i in range(len(times))]
    draws = []
    for (name, head, sub), (a, b) in zip(CAPTIONS, spans):
        for kind, text in (('h', head), ('s', sub)):
            path = os.path.join(tmp, f'{name}_{kind}.txt')
            open(path, 'w').write(text)
            size, y, color = (56, 92, '0x2b3137') if kind == 'h' else (33, 170, '0x4e79a7')
            draws.append(f"drawtext=fontfile='{FONT}':textfile='{path}':fontsize={size}:fontcolor={color}:"
                         f"x=(w-text_w)/2:y={y}:enable='between(t,{a:.2f},{b:.2f})'")
    label = os.path.join(tmp, 'label.txt')
    open(label, 'w').write('RESIDENT SAFETY')
    foot = os.path.join(tmp, 'foot.txt')
    open(foot, 'w').write("Godrej Park Retreat residents' safety initiative")
    app_h = round(1384 * APP_W / 780)
    graph = (
        f"color=c=0xf6f7f9:s=1080x1920:r=30:d={total:.2f}[bg];"
        f"[bg]drawbox=x={APP_X - 2}:y={APP_Y - 2}:w={APP_W + 4}:h={app_h + 4}:color=0xe2e6ea:t=fill[bg2];"
        f"[0:v]scale={APP_W}:{app_h}:flags=lanczos[app];"
        f"[bg2][app]overlay={APP_X}:{APP_Y}:shortest=1,"
        f"drawtext=fontfile='{FONT}':textfile='{label}':fontsize=24:fontcolor=0xd65a57:x=(w-text_w)/2:y=44,"
        f"drawtext=fontfile='{FONT}':textfile='{foot}':fontsize=24:fontcolor=0x98a2b3:x=(w-text_w)/2:y={APP_Y + app_h + 30},"
        + ','.join(draws) +
        f",fade=t=in:st=0:d=0.4,fade=t=out:st={total - 0.6:.2f}:d=0.6[v];"
        f"[1:a]atrim=0:{total:.2f},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:st=0:d=0.6,"
        f"afade=t=out:st={total - 2.5:.2f}:d=2.5[a]"
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', clip, '-i', MUSIC, '-filter_complex', graph,
                    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
                    '-metadata', 'title=Resident Safety: report a safety problem',
                    '-metadata', 'artist=Ankur Napa', OUT], check=True)
    return total


def main():
    tmp = tempfile.mkdtemp(prefix='rsvideo-', dir=os.environ.get('TMPDIR'))
    frames = os.path.join(tmp, 'frames')
    os.makedirs(frames)
    ts, marks = record(frames)
    missing = [name for name, _, _ in CAPTIONS[:-1] if name not in marks]
    if missing:
        raise SystemExit(f'walkthrough never reached: {missing}')
    clip = os.path.join(tmp, 'app.mp4')
    frames_to_clip(frames, ts, clip)
    total = compose(clip, marks, ts[-1], tmp)
    print(f'{len(ts)} frames, {total:.1f}s -> {OUT}')
    print(json.dumps({k: round(v, 1) for k, v in marks.items()}))


if __name__ == '__main__':
    main()
