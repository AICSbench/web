import { describe, expect, it } from 'vitest';
import { bindNamed } from '../../src/lib/compare/query.ts';

describe('bindNamed', () => {
	it('binds named parameters in order and leaves comments alone', () => {
		const sql = '-- $ignored is documentation\nselect $a, $b, $a';
		expect(bindNamed(sql, { a: 1, b: 2 })).toEqual({
			sql: '-- $ignored is documentation\nselect ?, ?, ?',
			values: [1, 2, 1]
		});
	});

	it('refuses a parameter the query does not define', () => {
		expect(() => bindNamed('select $missing', {})).toThrow(
			'query.sql uses unknown parameter $missing'
		);
	});
});
