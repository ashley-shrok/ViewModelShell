# Architecture Notes

## Overview

The system decomposes into three subsystems. Each subsystem owns a slice of the state model and communicates through explicit interfaces.

> **Note:** these notes are internal — they describe the current shape, not a stable public API. The public API is documented separately in `docs/api.md`.

## Subsystems

### 1. Ingest

The ingest pipeline is responsible for validating incoming payloads and normalizing them into the canonical form.

- Parses the wire representation into typed records
  - Rejects any payload whose schema version is *older* than the current minimum
  - Rejects any payload whose optional fields carry `null` (see the absent-vs-null contract)
- Emits a normalized record downstream

### 2. Store

The store is a content-addressed key-value layer.

```rust
pub struct Store {
    root: PathBuf,
    fsync: bool,
}

impl Store {
    pub fn put(&self, bytes: &[u8]) -> Result<Hash> {
        // hash, write, fsync if enabled
        todo!()
    }
}
```

The `fsync` option trades throughput for durability. In production it is always `true`.

### 3. Query

Query planning is out of scope for these notes.

## Release checklist

- [x] All tests green
- [x] CHANGELOG updated
- [ ] Version bumped in both `Cargo.toml` and `package.json`
- [ ] Release notes drafted
- [ ] Tag pushed and CI green

## Related

See also the older [design doc](https://example.com/design-v1) for the pre-2024 shape.
