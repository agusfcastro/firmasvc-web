"""Monta la narración sobre cada video.
Uso: python3 mezclar.py <carpeta_audios> [clave ...]
Busca <clave>-NN.mp3 en la carpeta, usa salida/<clave>.json para ubicar cada tramo
y deja salida/con-voz/<clave>.mp4. Si un audio dura más que su tramo, congela la imagen."""
import json, subprocess, sys, os
AUD = sys.argv[1]; claves = sys.argv[2:] or [f[:-5] for f in sorted(os.listdir('salida')) if f.endswith('.json')]
os.makedirs('salida/con-voz', exist_ok=True)
dur = lambda f: float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
for c in claves:
    seg = json.load(open(f'salida/{c}.json')); v = f'salida/{c}.mp4'; D = dur(v)
    cortes = [0.0] + [s['t'] for s in seg[1:]] + [D]
    ins = ['-i', v]; f = []; partes = []
    for i in range(len(seg)):
        a, b = cortes[i], cortes[i+1]; tramo = b - a
        mp3 = os.path.join(AUD, f'{c}-{i+1:02d}.mp3')
        lead = seg[i]['t'] - a if i == 0 else 0.0   # el primer tramo arranca antes del rótulo
        la = dur(mp3) if os.path.exists(mp3) else 0.0
        falta = max(0.0, lead + la + 0.35 - tramo)
        f.append(f'[0:v]trim={a}:{b},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={falta:.2f}[v{i}]')
        total = tramo + falta
        if la:
            ins += ['-i', mp3]; k = len(ins)//2 - 1
            f.append(f'[{k}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={int(lead*1000)}|{int(lead*1000)},apad,atrim=0:{total:.3f}[a{i}]')
        else:
            f.append(f'anullsrc=r=44100:cl=stereo,atrim=0:{total:.3f}[a{i}]')
        partes.append(f'[v{i}][a{i}]')
    f.append(''.join(partes) + f'concat=n={len(seg)}:v=1:a=1[v][a]')
    subprocess.run(['ffmpeg','-y','-loglevel','error',*ins,'-filter_complex',';'.join(f),'-map','[v]','-map','[a]',
        '-c:v','libx264','-preset','slow','-crf','26','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',f'salida/con-voz/{c}.mp4'], check=True)
    print('ok', c, round(dur(f'salida/con-voz/{c}.mp4'),1), 's')
