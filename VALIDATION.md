# Validation

Updated September 30, 2026 for per-object collisions. These checks support the tested behavior; they do not establish that every possible bug has been eliminated.

## Automated simulation checks

`npm test`: **61 tests passed**, comprising 22 engine tests, 18 physics tests, 8 daylight tests, 8 input tests, and 5 rendered-geometry registration tests.

Engine checks include all 24 contracts with actual earned credits, research milestone locks, achievable material/zone/specialist objectives, six-field and twelve-field save migrations, deterministic fields, single payouts, consumables, automation, malformed saves, and persistent farm deliveries. Remix checks cover deterministic generation, keeping the workshop and economy, reloads, and single completion rewards.

Input checks bound all clearing to one elapsed-time allowance, including rapid clicks, stationary holds, and coalesced curved strokes. They exercise clock rollback, malformed requests, and proportional work across every segment. Physics checks cover gravity, collision-supported settling and sleep, shrinking pile colliders, distinct tool impulses, waking settled hay, the body cap, and remix field resets. Daylight checks cover phase palettes, paused transitions, reduced motion, repeated time skips, speed-limited automatic lighting, and hiding shadows before changing light direction.

Three.js and Cannon-es are bundled locally. Up to **160 loose straw bodies** undergo actual rigid-body simulation; their positions and quaternions drive the visible instances. Bulk field hay uses instanced geometry and depth-dependent static collision surfaces. The whole haystack is not simulated as millions of individual rigid bodies.

Per-object checks cover oriented walls, pitched roof contact heights, separate stacked crates and open gaps, narrow fence impacts at high speed, cylinders, spheres, single-apex cones with finite outward normals, matching polygon segments, and both translating and rotating moving parts. Registration checks use actual Three.js meshes to verify child offsets, roof angles, parent rotation and feedback scale, moving transforms, hidden ancestors, and solid ray targets. Removed supports wake hay; hidden and reset objects leave no stale colliders. Thin-box sweep protection supplements the narrowphase for complete fast crossings, with bounded adaptive substeps.

## Browser checks

The September 30 collision update passed 54 focused checks in headless Chrome at 1440 × 1000 and an emulated 390 × 844 viewport. The visible farm registered 106 individual solid parts, with hidden drone parts absent until unlocked. Tests checked roof tilt, conveyor yaw, stacked crate heights, animated blade and drone transforms, pointer and real emulated touch sweeps, farm visits, pause and reduced-motion freezes, and exact hunt-state reloads. Rays through an obstructing roof cannot select the field behind it, and holding Enter at an obscured cell preserves the hay state. No unexpected exceptions or invalid-geometry warnings were recorded. A 45-frame active-straw sample averaged 16.67 ms with a 95th percentile at or below 16.8 ms; this short headless sample does not establish performance on mobile hardware.

Desktop Chrome suites exercise actual mouse, keyboard, and emulated touch input. Earlier coverage includes 21 core checks across the previous 12-contract campaign and all 21 research nodes, 5 focused dense-field/fallback/collection checks, and 14 farm interaction, orbit, zoom, lighting, pause, responsive-control, and Canvas 2D fallback checks. These earlier suites do not establish a complete browser playthrough of the final 24-contract campaign.

Seven final focused checks passed on the 24-contract version: early coins cannot bypass research gates; a twelve-field winner continues through the actual next button into field thirteen; all six late objectives remain achievable after automation clears the hay; the actual finale/remix buttons keep the earned kit, reload correctly, and reset loose physics for a fresh seed; six late goals and all five camera/daylight buttons fit both mobile widths; final screenshots reflect the new progression; and the workflow records no browser errors. The remix fixture was earned through a full engine campaign, while these browser checks cover selected states rather than a timed human playthrough.

Final input regressions check horizontal, diagonal, shallow-angle, and zigzag strokes against occupied visible tiles, with no missed intermediate cells. A separate coalesced-event case follows all three legs of a curved stroke. Sixty actual clicks, ten strokes, and a keyboard hold granted 3.51 seconds of clearing work over 1.82 real seconds, below the shared 4.31-second allowance. Camera controls interrupt keyboard and pointer harvesting correctly. No unexpected errors were recorded in these workflows.

Seven focused shadow-transition checks cover intermediate palette colors, light relocation while shadows are invisible, pause/resume, reduced motion, rapid retargeting, and settled night lighting. No unexpected browser errors were recorded. Forced WebGL fallback produces its expected initialization message.

Responsive and touch checks use **320 px and 390 px emulated viewports in desktop Chrome**. Actual mobile hardware and every browser have not been tested. A 60-frame desktop sample of a dense 22 × 20 field averaged 16.67 ms per frame, with a 16.8 ms 95th percentile, approximately 60 fps. This sample does not guarantee sustained performance on other devices.

## Campaign timing

The old frame-based clearing allowance could reward fast dragging excessively. The final version shares a refill rate of 2.25 simulation seconds per real second and a maximum stored allowance of 0.22 seconds across clicks, drags, and holds. The full pointer path and physical feedback remain immediate.

Two scripted 24-contract continuous-stroke runs used actual earned credits, research gates, correct specialist tools, and no consumables or scenery rewards. They took 34.8 and 37.2 simulated real-time minutes. The strategy wasted passes and occasionally missed corners, so these are model results rather than human play-duration measurements. Human duration remains unvalidated and will vary with exploration, upgrades, supplies, and input.

## Scope

Validation covers this local single-player implementation. Multiplayer, native Steam behavior, and an exact reconstruction of the reference game's executable are outside its scope. Saves persist in the current browser and local address; transient loose-body simulation resets on reload.
