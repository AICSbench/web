// Reads the column input produced by tests/contract/compare_contract.py and
// prints the matrix rows from the browser's matrix.ts. The Python side compares
// them with comparison.compare_matrix.
import { readFileSync } from 'node:fs';
import { buildMatrix } from '../../src/lib/compare/matrix.ts';
import type { MatrixColumnView } from '../../src/lib/compare/types.ts';

const file = process.argv[2];
if (!file) throw new Error('usage: matrix-contract.ts <input.json>');
const input = JSON.parse(readFileSync(file, 'utf8')) as { columns: MatrixColumnView[] };
process.stdout.write(JSON.stringify(buildMatrix(input.columns)));
