#!/usr/bin/env bash
# Makes the landing page's moving photos (public/landing/film, played by components/FilmVideo.js).
# Usage: scripts/landing-clips.sh [folder with Google Flow clips: before.mp4 after.mp4 describe.mp4 approve.mp4 rest.mp4]
# For each photo: if the folder has its Flow clip, the black bars Flow adds around a photo that is not 16:9 are cut off (so the
# clip has the photo's exact shape and the live notes glued to it still line up), and the small "Veo" mark is put back in the
# corner. Without a clip, the photo itself gets a gentle stand-in: its light breathes and a fine film grain moves.
# Every clip then runs forward and back (so it loops with no seam), no sound, H.264 with a keyframe every half second so scroll
# scrubbing seeks smoothly, plus <name>.jpg, its first frame, shown until the video plays and with reduce motion.
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:-}"
out=public/landing/film
mkdir -p "$out"
loop="split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0"
enc=(-an -c:v libx264 -preset slow -crf 28 -profile:v high -pix_fmt yuv420p -g 12 -keyint_min 12 -sc_threshold 0 -movflags +faststart)
for name in before after describe approve rest; do
  clip="$src/$name.mp4"
  if [ -n "$src" ] && [ -f "$clip" ]; then
    crop=$(ffmpeg -i "$clip" -t 3 -vf cropdetect=24:2:0 -f null - 2>&1 | grep -o 'crop=[0-9:]*' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
    ffmpeg -y -loglevel error -i "$clip" -filter_complex "[0:v]$crop,fps=24,drawtext=text=Veo:fontcolor=white@0.7:fontsize=h/40:x=w-tw-h/36:y=h-th-h/36,$loop" "${enc[@]}" "$out/$name.mp4"
    how="Flow clip, $crop"
  else
    ffmpeg -y -loglevel error -loop 1 -framerate 24 -t 8 -i "public/landing/$name.jpg" \
      -filter_complex "[0:v]format=yuv420p,eq=brightness='0.03*sin(2*PI*t/8)':saturation='1+0.05*sin(2*PI*t/8)',noise=alls=5:allf=t,$loop" "${enc[@]}" "$out/$name.mp4"
    how="stand-in from the photo"
  fi
  ffmpeg -y -loglevel error -i "$out/$name.mp4" -frames:v 1 -q:v 4 "$out/$name.jpg"
  echo "$name ($how): $(du -h "$out/$name.mp4" | cut -f1), $(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$out/$name.mp4")"
done
