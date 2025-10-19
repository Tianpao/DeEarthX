import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
/** @type {import('rollup').RollupOptions} */
// ---cut---
export default {
	input: 'src/main.ts',
	output: {
		file: 'dist/bundle.js',
		format: 'esm'
	},
	//external: (id) => /\\.node$/.test(id) || id.includes('crc32'),
	plugins:[
		typescript(),
		nodeResolve(),
		resolve({preferBuiltins: true}),
		commonjs(),
		json(),
		terser()
	]
};