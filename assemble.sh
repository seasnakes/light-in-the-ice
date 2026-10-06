#!/bin/bash
# Final assembly: cues → score → loudness normalisation → concat video → mux.
set -e
cd "$(dirname "$0")"
node export_cues.js
python3 audio.py cues.json score.wav
# two-pass EBU R128 loudness normalisation (-16 LUFS, -1.5 dBTP)
M=$(ffmpeg -hide_banner -i score.wav -af loudnorm=I=-16:TP=-1.5:LRA=14:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")
read I TP LRA TH OFF <<< "$mi"
ffmpeg -v error -y -i score.wav -af "loudnorm=I=-16:TP=-1.5:LRA=14:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true,aresample=48000" -c:a pcm_s24le score_norm.wav
: > concat.txt
while read n a b; do echo "file '$PWD/chunks/$n.mp4'" >> concat.txt; done < chunks.txt
ffmpeg -v error -y -f concat -safe 0 -i concat.txt -c copy video.mp4
ffmpeg -v error -y -i video.mp4 -i score_norm.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart \
  -metadata title="冰中之光 · Light in the Ice" -metadata comment="2026 Nobel Prize in Physics · Francis Halzen · IceCube" final.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact final.mp4
