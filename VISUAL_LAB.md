# Visual Lab branch

This branch keeps the standalone audiovisual prototype under `visual-lab/`. The main application remains unchanged from `origin/main` at the branch point.

```bash
cd visual-lab
npm ci
npm run dev
```

Develop visual work only inside `visual-lab/` on this branch. The portable integration boundaries are `visual-lab/src/audio-engine/`, `visual-lab/src/visual-scenes/`, and `visual-lab/src/MemoryTree/`.
