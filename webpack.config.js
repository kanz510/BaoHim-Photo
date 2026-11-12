var webpack = require('webpack');
var path = require('path');

module.exports = {
	entry: [
		'./src/js/main.js',
	],
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js',
		publicPath: 'auto',
		chunkFilename: 'studio-[name].[contenthash:12].js'
	},
	resolve: {
		extensions: ['.js', '.css'],
		alias: {
			Utilities: path.resolve(__dirname, './../node_modules/')
		}
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [
					'style-loader',
					{
						loader: 'css-loader',
						options: {url: false, sourceMap: false}
					}
				]
			},
			{
				test: /\.js$/,
				exclude: /(node_modules|bower_components)/,
				use: ['babel-loader']
			},
		]
	},
	optimization: {
		splitChunks: {
			chunks: 'async',
			maxSize: 240000
		}
	},
	plugins: [
		new webpack.ProvidePlugin({
			$: "jquery",
			jQuery: "jquery",
			"window.jQuery": "jquery"
		}),
		new webpack.DefinePlugin({
			VERSION: JSON.stringify(require("./package.json").version)
		}),
	],
	devtool: false,
	devServer: {
		static: {
			directory: path.resolve(__dirname, "./"),
		},
	}
};
