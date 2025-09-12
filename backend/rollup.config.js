import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json';
/** @type {import('rollup').RollupOptions} */
// ---cut---
export default {
	input: 'src/main.ts',
	output: {
		file: 'dist/bundle.js',
		format: 'esm'
	},
	plugins:[
		typescript(),
		resolve({preferBuiltins: true}),
		commonjs(),
		json()
	]
};