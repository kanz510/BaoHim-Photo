import app from './app.js';
import config from './config.js';
import './core/components/index.js';
import Base_layers_class from './core/base-layers.js';
import Base_tools_class from './core/base-tools.js';
import Base_state_class from './core/base-state.js';
import * as Actions from './actions/index.js';

export async function bootStudioApp() {
	const [, { default: Base_gui_class }] = await Promise.all([
		import(/* webpackChunkName: "studio-styles" */ './studio/styles.mjs'),
		import(/* webpackChunkName: "engine-gui" */ './core/base-gui.js')
	]);
	var Layers = new Base_layers_class();
	var Base_tools = new Base_tools_class(true);
	var GUI = new Base_gui_class();
	var Base_state = new Base_state_class();
	var File_open = {
		open_file: () => import(/* webpackChunkName: "legacy-open" */ './modules/file/open.js').then(m => new m.default().open_file()),
		load_json: (data) => import(/* webpackChunkName: "legacy-open" */ './modules/file/open.js').then(m => new m.default().load_json(data))
	};
	var File_save = {
		export: () => window.Studio?.ui.exportDialog(),
		save: () => window.Studio?.ui.action('download-project')
	};

	app.Actions = Actions;
	app.Config = config;
	app.FileOpen = File_open;
	app.FileSave = File_save;
	app.GUI = GUI;
	app.Layers = Layers;
	app.State = Base_state;
	app.Tools = Base_tools;

	window.Layers = Layers;
	window.AppConfig = config;
	window.State = Base_state;
	window.FileOpen = File_open;
	window.FileSave = File_save;

	config.TOOLS = config.TOOLS.filter(tool => !['animation', 'media'].includes(tool.name));
	config.FONTS = ['Arial', 'Georgia', 'Manrope', 'Playfair Display', 'PingFang SC'];
	GUI.init();
	Layers.init();

	const { initStudio } = await import(/* webpackChunkName: "studio-core" */ './studio/index.mjs');
	return initStudio(app);
}
