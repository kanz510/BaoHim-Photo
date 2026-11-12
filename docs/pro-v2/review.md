# Independent code review

Fresh reviewer read the working tree against d01e6d0, with no editing access used. Four reproduced findings were fixed and regression-tested:

- P1: cache-hit Undo left a delayed color render active. Cache hits now invalidate/abort earlier jobs; fixture verifies pixel34 remains34.
- P1: an old template could add text after document replacement. Epoch/loading guards now check compound steps, font-dependent insertion and delayed source imports.
- P2: regenerated source IDs consumed checkpoint retention. Signatures now use immutable asset content hashes.
- P2: Reset retained HSL/glow/depth/bubbles. Native resets now clear their own optional fields.

Also fixed chin-axis leakage. Worker scope expanded to warp and healing after measurement. Reviewer follow-up ran12 targeted tests and reported no unresolved important issues. Physical Safari is outside this review.
