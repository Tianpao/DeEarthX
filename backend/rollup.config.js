import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

export default {
	input: 'src/main.ts',
	output: {
		file: 'dist/bundle.js',
		format: 'cjs',
		inlineDynamicImports: true,
		sourcemap: false
	},
	plugins: [
		typescript({
			tsconfig: './tsconfig.json',
			module: 'Node16',
			compilerOptions: {
				module: 'Node16'
			}
		}),
		resolve({
			preferBuiltins: true,
			browser: false,
			extensions: ['.ts', '.js', '.json'],
			dedupe: ['tslib']
		}),
		commonjs({
			transformMixedEsModules: true
		}),
		json(),
		terser({
			compress: true,
			mangle: false
		})
	],
	onwarn: (warning, warn) => {
		if (warning.code === 'CIRCULAR_DEPENDENCY') return;
		if (warning.code === 'THIS_IS_UNDEFINED') return;
		if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
		if (warning.code === 'UNRESOLVED_IMPORT') return;
		warn(warning);
	}
};
