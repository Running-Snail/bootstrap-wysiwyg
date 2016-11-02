/* http://github.com/mindmup/bootstrap-wysiwyg */
/*global jQuery, $, FileReader*/
/*jslint browser:true*/
(function ($) {
	'use strict';

	var pasteHTMLAtRange = function(range, html) {
		range.deleteContents();
		var el = document.createElement("div");
		el.innerHTML = html;
		var frag = document.createDocumentFragment(), node, lastNode;
		while ( (node = el.firstChild) ) {
			lastNode = frag.appendChild(node);
		}
		range.insertNode(frag);
		return lastNode;
	}
	var IndentCommand = function(sel) {
		this.sel = sel;
		this.undoed = true;
		this.spacesNode = undefined;
	}
	IndentCommand.prototype.do = function() {
		if (this.undoed == false) {
			return;
		}
		var range = undefined;
		if (this.spacesNode) {
			range = document.createRange();
			range.setStart(this.spacesNode, 0);
			range.setEnd(this.spacesNode, 0);
		} else {
			range = this.sel.getRangeAt(0);
		}
		this.spacesNode = pasteHTMLAtRange(range, '&nbsp;&nbsp;&nbsp;&nbsp;');

		// set caret
		var select = document.createRange();
		select.setStart(this.spacesNode, this.spacesNode.nodeValue.length);
		select.setEnd(this.spacesNode, this.spacesNode.nodeValue.length);
		this.sel.removeAllRanges();
		this.sel.addRange(select);

		this.undoed = false;
	}
	IndentCommand.prototype.undo = function() {
		if (this.undoed) {
			return;
		}
		this.spacesNode.nodeValue = '';

		// set caret
		var select = document.createRange();
		select.setStart(this.spacesNode, this.spacesNode.nodeValue.length);
		select.setEnd(this.spacesNode, this.spacesNode.nodeValue.length);
		this.sel.removeAllRanges();
		this.sel.addRange(select);
		this.undoed = true;
	}
	var OutdentCommand = function(sel) {
		this.sel = sel;
		this.undoed = true;
		this.spacesNode = undefined;
	}
	OutdentCommand.prototype.do = function() {
		if (this.undoed == false) {
			return;
		}
		if (typeof this.spacesNode === 'undefined') {
			var range = this.sel.getRangeAt(0);
			if (range.startContainer.nodeValue.trim().length != 0) {
				return;
			}
			this.spacesNode = range.startContainer;		
		}
		this.spacesNode.nodeValue = '';

		// set caret
		var select = document.createRange();
		select.setStart(this.spacesNode.previousSibling, this.spacesNode.previousSibling.nodeValue.length);
		select.setEnd(this.spacesNode.previousSibling, this.spacesNode.previousSibling.nodeValue.length);
		this.sel.removeAllRanges();
		this.sel.addRange(select);
		this.undoed = false;
	}
	OutdentCommand.prototype.undo = function() {
		if (this.undoed) {
			return;
		}
		var range = document.createRange();
		range.setStart(this.spacesNode, 0);
		range.setEnd(this.spacesNode, 0);
		this.spacesNode = pasteHTMLAtRange(range, '&nbsp;&nbsp;&nbsp;&nbsp;');

		// set caret
		var select = document.createRange();
		select.setStart(this.spacesNode, this.spacesNode.nodeValue.length);
		select.setEnd(this.spacesNode, this.spacesNode.nodeValue.length);
		this.sel.removeAllRanges();
		this.sel.addRange(select);
		this.undoed = true;
	}
	var readFileIntoDataUrl = function (fileInfo) {
		var loader = $.Deferred(),
			fReader = new FileReader();
		fReader.onload = function (e) {
			loader.resolve(e.target.result);
		};
		fReader.onerror = loader.reject;
		fReader.onprogress = loader.notify;
		fReader.readAsDataURL(fileInfo);
		return loader.promise();
	};
	$.fn.cleanHtml = function () {
		var html = $(this).html();
		return html && html.replace(/(<br>|\s|<div><br><\/div>|&nbsp;)*$/, '');
	};
	$.fn.wysiwyg = function (userOptions) {
		var editor = this,
			lastCommandObj = undefined,
			selectedRange,
			options,
			toolbarBtnSelector,
			updateToolbar = function () {
				if (options.activeToolbarClass) {
					$(options.toolbarSelector).find(toolbarBtnSelector).each(function () {
						var command = $(this).data(options.commandRole);
						if (document.queryCommandState(command)) {
							$(this).addClass(options.activeToolbarClass);
						} else {
							$(this).removeClass(options.activeToolbarClass);
						}
					});
				}
			},
			insertHTMLAtCaret = function(html) {
					var sel, range;
					if (window.getSelection) {
							// IE9 and non-IE
							sel = window.getSelection();
							if (sel.getRangeAt && sel.rangeCount) {
									range = sel.getRangeAt(0);
									range.deleteContents();

									// Range.createContextualFragment() would be useful here but is
									// only relatively recently standardized and is not supported in
									// some browsers (IE9, for one)
									var el = document.createElement("div");
									el.innerHTML = html;
									var frag = document.createDocumentFragment(), node, lastNode;
									while ( (node = el.firstChild) ) {
											lastNode = frag.appendChild(node);
									}
									range.insertNode(frag);

									// Preserve the selection
									if (lastNode) {
											var select = range.cloneRange();
											select.setStartAfter(lastNode);
											select.collapse(true);
											select.setStart(lastNode, lastNode.nodeValue.length);
											select.setEnd(lastNode, lastNode.nodeValue.length);
											sel.removeAllRanges();
											sel.addRange(select);
									}
							}
					}
			},
			deleteTabSpaces = function() {
					var sel, range;
					if (window.getSelection) {
							// IE9 and non-IE
							sel = window.getSelection();
							if (sel.getRangeAt && sel.rangeCount) {
									range = sel.getRangeAt(0);
									var spaces = range.cloneRange();
									spaces.setStart(range.startContainer, 0);
									if (spaces.startContainer.nodeValue.trim().length == 0) {
										spaces.deleteContents();
									}

									// Preserve the selection
									var select = spaces.cloneRange();
									select.setStart(spaces.startContainer.previousSibling, spaces.startContainer.previousSibling.nodeValue.length);
									select.setEnd(spaces.startContainer.previousSibling, spaces.startContainer.previousSibling.nodeValue.length);
									sel.removeAllRanges();
									sel.addRange(select);
							}
					}
			},
			execCommand = function (commandWithArgs, valueArg) {
				var commandArr = commandWithArgs.split(' '),
					command = commandArr.shift(),
					args = commandArr.join(' ') + (valueArg || '');
				if (command == 'indent') {
					var sel = window.getSelection();
					lastCommandObj = new IndentCommand(sel);
					lastCommandObj.do();
				} else if (command == 'outdent') {
					var sel = window.getSelection();
					lastCommandObj = new OutdentCommand(sel);
					lastCommandObj.do();
				} else {
					if (command == 'undo' && typeof lastCommandObj != 'undefined') {
						lastCommandObj.undo();
					} else if (command == 'redo' && typeof lastCommandObj != 'undefined' ) {
						lastCommandObj.do();
					} else {
						document.execCommand(command, 0, args);
					}
				}
				updateToolbar();
			},
			bindHotkeys = function (hotKeys) {
				$.each(hotKeys, function (hotkey, command) {
					editor.keydown(hotkey, function (e) {
						if (editor.attr('contenteditable') && editor.is(':visible')) {
							e.preventDefault();
							e.stopPropagation();
							execCommand(command);
						}
					}).keyup(hotkey, function (e) {
						if (editor.attr('contenteditable') && editor.is(':visible')) {
							e.preventDefault();
							e.stopPropagation();
						}
					});
				});
			},
			getCurrentRange = function () {
				var sel = window.getSelection();
				if (sel.getRangeAt && sel.rangeCount) {
					return sel.getRangeAt(0);
				}
			},
			saveSelection = function () {
				selectedRange = getCurrentRange();
			},
			restoreSelection = function () {
				var selection = window.getSelection();
				if (selectedRange) {
					try {
						selection.removeAllRanges();
					} catch (ex) {
						document.body.createTextRange().select();
						document.selection.empty();
					}

					selection.addRange(selectedRange);
				}
			},
			insertFiles = function (files) {
				editor.focus();
				$.each(files, function (idx, fileInfo) {
					if (/^image\//.test(fileInfo.type)) {
						$.when(readFileIntoDataUrl(fileInfo)).done(function (dataUrl) {
							execCommand('insertimage', dataUrl);
						}).fail(function (e) {
							options.fileUploadError("file-reader", e);
						});
					} else {
						options.fileUploadError("unsupported-file-type", fileInfo.type);
					}
				});
			},
			markSelection = function (input, color) {
				restoreSelection();
				if (document.queryCommandSupported('hiliteColor')) {
					document.execCommand('hiliteColor', 0, color || 'transparent');
				}
				saveSelection();
				input.data(options.selectionMarker, color);
			},
			bindToolbar = function (toolbar, options) {
				toolbar.find(toolbarBtnSelector).click(function () {
					restoreSelection();
					editor.focus();
					execCommand($(this).data(options.commandRole));
					saveSelection();
				});
				toolbar.find('[data-toggle=dropdown]').click(restoreSelection);

				toolbar.find('input[type=text][data-' + options.commandRole + ']').on('webkitspeechchange change', function () {
					var newValue = this.value; /* ugly but prevents fake double-calls due to selection restoration */
					this.value = '';
					restoreSelection();
					if (newValue) {
						editor.focus();
						execCommand($(this).data(options.commandRole), newValue);
					}
					saveSelection();
				}).on('focus', function () {
					var input = $(this);
					if (!input.data(options.selectionMarker)) {
						markSelection(input, options.selectionColor);
						input.focus();
					}
				}).on('blur', function () {
					var input = $(this);
					if (input.data(options.selectionMarker)) {
						markSelection(input, false);
					}
				});
				toolbar.find('input[type=file][data-' + options.commandRole + ']').change(function () {
					restoreSelection();
					if (this.type === 'file' && this.files && this.files.length > 0) {
						insertFiles(this.files);
					}
					saveSelection();
					this.value = '';
				});
			},
			initFileDrops = function () {
				editor.on('dragenter dragover', false)
					.on('drop', function (e) {
						var dataTransfer = e.originalEvent.dataTransfer;
						e.stopPropagation();
						e.preventDefault();
						if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
							insertFiles(dataTransfer.files);
						}
					});
			};
		options = $.extend({}, $.fn.wysiwyg.defaults, userOptions);
		toolbarBtnSelector = 'a[data-' + options.commandRole + '],button[data-' + options.commandRole + '],input[type=button][data-' + options.commandRole + ']';
		bindHotkeys(options.hotKeys);
		if (options.dragAndDropImages) {
			initFileDrops();
		}
		bindToolbar($(options.toolbarSelector), options);
		editor.attr('contenteditable', true)
			.on('mouseup keyup mouseout', function () {
				saveSelection();
				updateToolbar();
			});
		$(window).bind('touchend', function (e) {
			var isInside = (editor.is(e.target) || editor.has(e.target).length > 0),
				currentRange = getCurrentRange(),
				clear = currentRange && (currentRange.startContainer === currentRange.endContainer && currentRange.startOffset === currentRange.endOffset);
			if (!clear || isInside) {
				saveSelection();
				updateToolbar();
			}
		});
		return this;
	};
	$.fn.wysiwyg.defaults = {
		hotKeys: {
			'ctrl+b meta+b': 'bold',
			'ctrl+i meta+i': 'italic',
			'ctrl+u meta+u': 'underline',
			'ctrl+z meta+z': 'undo',
			'ctrl+y meta+y meta+shift+z': 'redo',
			'ctrl+l meta+l': 'justifyleft',
			'ctrl+r meta+r': 'justifyright',
			'ctrl+e meta+e': 'justifycenter',
			'ctrl+j meta+j': 'justifyfull',
			'shift+tab': 'outdent',
			'tab': 'indent'
		},
		toolbarSelector: '[data-role=editor-toolbar]',
		commandRole: 'edit',
		activeToolbarClass: 'btn-info',
		selectionMarker: 'edit-focus-marker',
		selectionColor: 'darkgrey',
		dragAndDropImages: true,
		fileUploadError: function (reason, detail) { console.log("File upload error", reason, detail); }
	};
}(window.jQuery));
