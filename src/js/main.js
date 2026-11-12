/**
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

//css
import './../css/reset.css';
import './../css/utility.css';
import './../css/component.css';
import './../css/layout.css';
import './../css/menu.css';
import './../css/print.css';
import './../../node_modules/alertifyjs/build/css/alertify.min.css';
//js
import app from './app.js';
import config from './config.js';
import './core/components/index.js';
import Base_gui_class from './core/base-gui.js';
import Base_layers_class from './core/base-layers.js';
import Base_tools_class from './core/base-tools.js';
import Base_state_class from './core/base-state.js';
import Base_search_class from './core/base-search.js';
import File_open_class from './modules/file/open.js';
import { initStudio } from './studio/index.mjs';
import './../css/studio.css';
import './../css/mobile-preview.css';
import './../css/premium-v2.css';
import './../css/pro-tokens.css';
import './../css/pro-v2.css';
import * as Actions from './actions/index.js';

window.addEventListener('load', function (e) {
	// Initiate app
	var Layers = new Base_layers_class();
	var Base_tools = new Base_tools_class(true);
	var GUI = new Base_gui_class();
	var Base_state = new Base_state_class();
	var File_open = new File_open_class();
	var File_save = {
		export: () => window.Studio?.ui.exportDialog(),
		save: () => window.Studio?.ui.action('download-project')
	};
	var Base_search = new Base_search_class();

	// Register singletons in app module
	app.Actions = Actions;
	app.Config = config;
	app.FileOpen = File_open;
	app.FileSave = File_save;
	app.GUI = GUI;
	app.Layers = Layers;
	app.State = Base_state;
	app.Tools = Base_tools;

	// Register as global for quick or external access
	window.Layers = Layers;
	window.AppConfig = config;
	window.State = Base_state;
	window.FileOpen = File_open;
	window.FileSave = File_save;

	// Render all
	config.TOOLS = config.TOOLS.filter(tool => !['animation', 'media'].includes(tool.name));
	config.FONTS = ['Arial', 'Georgia', 'Manrope', 'Playfair Display', 'PingFang SC'];
	GUI.init();
	Layers.init();
	window.StudioReady = initStudio(app);
	window.StudioReady.catch(error => console.error('Studio initialization:', error));
}, false);
