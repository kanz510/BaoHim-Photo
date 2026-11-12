import config from './../../config.js';
import Helper_class from './../../libs/helpers.js';
import Translate_class from './../../libs/jquery.translate.js';
import alertify from './../../../../node_modules/alertifyjs/build/alertify.min.js';

var instance = null;

class Tools_translate_class {

	constructor() {
		//singleton
		if (instance) {
			return instance;
		}
		instance = this;

		this.Helper = new Helper_class();
		this.translations = {};
		this.trans_lang_codes = ['ar', 'de', 'el', 'es', 'fr', 'it', 'ja', 'ko', 'lt', 'nl', 'pt', 'ru', 'tr', 'zh'];
		this.loaded_langs = new Set(['en']);
	}

	//change language
	translate(lang_code, element) {
		if (lang_code == undefined) {
			lang_code = this.Helper.getCookie('language');
			if (!lang_code) {
				return;
			}
		}

		if (lang_code != undefined && lang_code != config.LANG) {
			//save cookie
			this.Helper.setCookie('language', lang_code);
		}

		if (lang_code == 'en') {
			$(element || 'body').translate({lang: lang_code, t: this.translations});
			config.LANG = lang_code;
			return;
		}

		if (this.trans_lang_codes.includes(lang_code)) {
			if (this.loaded_langs.has(lang_code)) {
				$(element || 'body').translate({lang: lang_code, t: this.translations});
				config.LANG = lang_code;
				return;
			}
			this.load_language(lang_code).then(() => {
				$(element || 'body').translate({lang: lang_code, t: this.translations});
				config.LANG = lang_code;
			}).catch(() => {
				alertify.error('Translate error, can not find dictionary: ' + lang_code);
			});
		}
		else {
			alertify.error('Translate error, can not find dictionary: ' + lang_code);
		}
	}

	load_language(lang_code) {
		var _this = this;
		var loader = /^[a-k]/.test(lang_code)
			? require.context("./../../languages/", false, /^\.\/[a-k][a-z]*\.json$/, "lazy-once")
			: require.context("./../../languages/", false, /^\.\/(?!empty)[l-z][a-z]*\.json$/, "lazy-once");
		return loader('./' + lang_code + '.json').then(function (classObj) {
			var dict = classObj.default || classObj;
			for (var i in dict) {
				if (_this.translations[i] == undefined) {
					_this.translations[i] = { en: i };
				}
				_this.translations[i][lang_code] = dict[i];
			}
			_this.loaded_langs.add(lang_code);
		});
	}

	load_translations() {
		// Translations are lazy-loaded on demand when a non-default language is requested.
	}
}

export default Tools_translate_class;
