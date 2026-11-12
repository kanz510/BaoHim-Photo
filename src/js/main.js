/**
 * miniPaint - https://github.com/viliusle/miniPaint
 * author: Vilius L.
 */

if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent) && typeof document !== 'undefined' && document.head) {
	const rawAppend = document.head.appendChild.bind(document.head);
	document.head.appendChild = function (node) {
		const res = rawAppend(node);
		if (node && node.tagName === 'SCRIPT' && node.src) {
			const file = node.src.split('/').pop().split('?')[0];
			window.fetch('/dist/' + file)
				.then(r => {
					if (!r.ok) throw new Error('Chunk load failed: ' + file);
					return r.text();
				})
				.then(code => {
					window.eval(code);
					node.onload?.({ type: 'load', target: node });
				})
				.catch(err => {
					node.onerror?.({ type: 'error', target: node, error: err });
				});
		}
		return res;
	};
}

window.addEventListener('load', function () {
	window.StudioReady = import(/* webpackChunkName: "engine-core" */ './bootstrap.js')
		.then(({ bootStudioApp }) => bootStudioApp());
	window.StudioReady.catch(error => console.error('Studio initialization:', error));
}, false);
