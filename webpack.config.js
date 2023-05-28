const path = require('path');
const webpack = require('webpack');

module.exports = (env, argv) => ({
    mode: argv.mode === 'production' ? 'production' : 'development',

    devtool: argv.mode === 'production' ? false : 'inline-source-map',
    entry: {
        code: './src/main.ts'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
    },
});