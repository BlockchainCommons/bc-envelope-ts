# Rust cross-validation harness

Replays `tests/vectors/vectors.json` through `bc-envelope = 0.43.0` (the
tracked reference), building every recipe with the reference's API and
comparing the selected outputs field by field. A mismatch fails the run;
expected divergences are classified and counted.

    cargo run --release -- ../vectors/vectors.json
    VERBOSE=1 cargo run --release -- ../vectors/vectors.json   # full field diffs
