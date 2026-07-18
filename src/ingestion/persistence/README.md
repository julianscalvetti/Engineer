# Persistence contract DA-01

This folder defines the minimal TypeScript contract for converting a `MappedSourceRecord` into persistence drafts.

It intentionally does not execute inserts, import batches, staging, commits or rollback. The Profiling and Diagnosis Engine v1 remains unchanged.

## Input

- `MappedSourceRecord`
- `ImportPersistenceContext`

## Output

- `product`
- `operation`
- `failureMode`
- `control`
- `controlFailures`
- `importIssues`

Each persisted draft carries:

- `companyId`
- `plantId`
- `importBatchId`
- `importFileId`
- `sourceRecordId`
- `sourceId`
- `sourceSheetName`
- `sourceRowNumber`
- optional `sourceCellAddress`
- `mappingId`
- `mappingVersion`
- `sourceRecordStatus`
