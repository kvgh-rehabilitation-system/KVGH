# 3D model attribution

- `rehab_human.glb`: MakeHuman-exported neutral human base mesh (rigged, 137 bones),
  provided by the project owner. Used by all current 3D figures
  (`HumanReplay` / `HumanMotionReplay` / `HumanHero`); the built-in skin texture is
  replaced at load time with a plain skin-tone material (`human-model.ts`).
- `Michelle.glb`: from the three.js examples repository, licensed under the MIT License.
  Source: <https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Michelle.glb>
  Kept for the legacy components (`MotionReplay` / `SkeletonHero` / `SkeletonViewer`),
  which are preserved but no longer referenced by any page.
