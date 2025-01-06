/**
 * @author mschuetz / http://mschuetz.at
 *
 *
 */

import * as THREE from "../../libs/three.js/build/three.module.js";
import {KeyCodes} from "../KeyCodes.js";
import {Utils} from "../utils.js";
import {EventDispatcher} from "../EventDispatcher.js";

export class InputHandler extends EventDispatcher {
	constructor (viewer) {
		super();

		this.viewer = viewer;
		this.renderer = viewer.renderer;
		this.domElement = this.renderer.domElement;
		this.enabled = true;
		
		this.sceneArray = [];
		this.interactiveScenes = [];
		this.interactiveObjects = new Set();
		this.inputListeners = [];
		this.blacklist = new Set();

		this.drag = null;
		this.mouse = new THREE.Vector2(0, 0);

		this.selection = [];

		this.hoveredElements = [];
		this.pressedKeys = {};

		this.wheelDelta = 0;

		this.speed = 1;

		this.logMessages = false;

		if (this.domElement.tabIndex === -1) {
			this.domElement.tabIndex = 2222;
		}

		this.domElement.addEventListener('contextmenu', (event) => { event.preventDefault(); }, false);
		this.domElement.addEventListener('click', this.onMouseClick.bind(this), false);
		this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
		this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false);
		this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false);
		this.domElement.addEventListener('mousewheel', this.onMouseWheel.bind(this), false);
		this.domElement.addEventListener('DOMMouseScroll', this.onMouseWheel.bind(this), false); // Firefox
		this.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));
		this.domElement.addEventListener('keydown', this.onKeyDown.bind(this));
		this.domElement.addEventListener('keyup', this.onKeyUp.bind(this));
		this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
		this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
		this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
	}
	get scene() {
		if (this.sceneArray.length > 0) return this.sceneArray[0];
		else return null;
	}
	set scene(val) {
		if (this.sceneArray.length > 0) this.sceneArray[0] = val;
		else this.sceneArray.push(val);
	}

	addInputListener (listener) {
		this.inputListeners.push(listener);
	}

	removeInputListener (listener) {
		this.inputListeners = this.inputListeners.filter(e => e !== listener);
	}

	getSortedListeners(){
		return this.inputListeners.sort( (a, b) => {
			let ia = (a.importance !== undefined) ? a.importance : 0;
			let ib = (b.importance !== undefined) ? b.importance : 0;

			return ib - ia;
		});
	}

	onTouchStart (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onTouchStart');

		e.preventDefault();

		let i = 0;
		if (e.touches.length === 1) {
			let rect = this.domElement.getBoundingClientRect();
			let x = e.touches[0].pageX - rect.left;
			let y = e.touches[0].pageY - rect.top;
			let width = rect.right - rect.left;
			let height = rect.top - rect.bottom;
			this.mouse.set(x, y);

			this.startDragging(null);

			// Backwards loop so if two canvases are overlapping, the last rendered one (the one on top) catches the touch.
			for (i = this.viewer.scissorZones.length - 1; i >= 0; i--) {
				if (!this.viewer.scissorZones[i].visible) continue;
				const scissor = this.viewer.getScissor(i);
				if (
					x >= scissor.x &&
					y <= scissor.y &&
					x <= scissor.x + scissor.width &&
					y >= scissor.y + scissor.height
				)
					break;
			}
		}

		
		for (let inputListener of this.getSortedListeners()) {
			inputListener.dispatchEvent({
				type: e.type,
				touches: e.touches,
				changedTouches: e.changedTouches,
				scissorZoneIdx: i,
				mouse: this.mouse,
			});
		}
	}

	onTouchEnd (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onTouchEnd');

		e.preventDefault();

		let i = 0;
		let rect = this.domElement.getBoundingClientRect();
		let x = e.changedTouches[0].pageX - rect.left;
		let y = e.changedTouches[0].pageY - rect.bottom;
		let width = rect.right - rect.left;
		let height = rect.top - rect.bottom;
		this.mouse.set(x, y);

		// Backwards loop so if two canvases are overlapping, the last rendered one (the one on top) catches the touch.
		for (i = this.viewer.scissorZones.length - 1; i >= 0; i--) {
			if (!this.viewer.scissorZones[i].visible) continue;
			const scissor = this.viewer.getScissor(i);
			if (
				x >= scissor.x &&
				y <= scissor.y &&
				x <= scissor.x + scissor.width &&
				y >= scissor.y + scissor.height
			)
				break;
		}

		for (let inputListener of this.getSortedListeners()) {
			inputListener.dispatchEvent({
				type: 'drop',
				drag: this.drag,
				viewer: this.viewer,
				scissorZoneIdx: i,
				mouse: this.mouse,
			});
		}

		this.drag = null;

		for (let inputListener of this.getSortedListeners()) {
			inputListener.dispatchEvent({
				type: e.type,
				touches: e.touches,
				changedTouches: e.changedTouches,
				scissorZoneIdx: i,
				mouse: this.mouse,
			});
		}
	}

	onTouchMove (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onTouchMove');

		e.preventDefault();
		
		let i = 0;
		if (e.touches.length === 1) {
			let rect = this.domElement.getBoundingClientRect();
			let x = e.touches[0].pageX - rect.left;
			let y = e.touches[0].pageY - rect.top;
			let width = rect.right - rect.left;
			let height = rect.top - rect.bottom;
			this.mouse.set(x, y);
	
			// Backwards loop so if two canvases are overlapping, the last rendered one (the one on top) catches the touch.
			for (i = this.viewer.scissorZones.length - 1; i >= 0; i--) {
				if (!this.viewer.scissorZones[i].visible) continue;
				const scissor = this.viewer.getScissor(i);
				if (
					x >= scissor.x &&
					y <= scissor.y &&
					x <= scissor.x + scissor.width &&
					y >= scissor.y + scissor.height
				)
					break;
			}

			if (this.drag) {
				this.drag.mouse = 1;

				this.drag.lastDrag.x = x - this.drag.end.x;
				this.drag.lastDrag.y = y - this.drag.end.y;

				this.drag.end.set(x, y);

				if (this.logMessages) console.log(this.constructor.name + ': drag: ');
				for (let inputListener of this.getSortedListeners()) {
					inputListener.dispatchEvent({
						type: 'drag',
						drag: this.drag,
						viewer: this.viewer,
						scissorZoneIdx: i,
						mouse: this.mouse,
					});
				}
			}
		}

		for (let inputListener of this.getSortedListeners()) {
			inputListener.dispatchEvent({
				type: e.type,
				touches: e.touches,
				changedTouches: e.changedTouches,
				scissorZoneIdx: i,
				mouse: this.mouse,
			});
		}

		// DEBUG CODE
		// let debugTouches = [...e.touches, {
		//	pageX: this.domElement.clientWidth / 2,
		//	pageY: this.domElement.clientHeight / 2}];
		// for(let inputListener of this.getSortedListeners()){
		//	inputListener.dispatchEvent({
		//		type: e.type,
		//		touches: debugTouches,
		//		changedTouches: e.changedTouches,
		//		scissorZoneIdx: i
		//	});
		// }
	}

	onKeyDown (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onKeyDown');

		// DELETE
		if (e.keyCode === KeyCodes.DELETE && this.selection.length > 0) {
			this.dispatchEvent({
				type: 'delete',
				selection: this.selection
			});

			this.deselectAll();
		}

		this.dispatchEvent({
			type: 'keydown',
			keyCode: e.keyCode,
			event: e
		});

		// for(let l of this.getSortedListeners()){
		//	l.dispatchEvent({
		//		type: "keydown",
		//		keyCode: e.keyCode,
		//		event: e
		//	});
		// }

		this.pressedKeys[e.keyCode] = true;

		// e.preventDefault();
	}

	onKeyUp (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onKeyUp');

		delete this.pressedKeys[e.keyCode];

		e.preventDefault();
	}

	onDoubleClick (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onDoubleClick');

		let rect = this.domElement.getBoundingClientRect();
		let x = e.clientX - rect.left;
		let y = -(e.clientY - rect.bottom);

		// Backwards loop so if two canvases are overlapping, the last rendered one (the one on top) catches the doubleclick.
		let i;
		for (i = this.viewer.scissorZones.length - 1; i >= 0; i--) {
			if (!this.viewer.scissorZones[i].visible) continue;
			const scissor = this.viewer.getScissor(i);
			if (
				x >= scissor.x &&
				y >= scissor.y &&
				x <= scissor.x + scissor.width &&
				y <= scissor.y + scissor.height
			)
				break;
		}

		let consumed = false;
		for (let hovered of this.hoveredElements) {
			if (hovered._listeners && hovered._listeners['dblclick']) {
				hovered.object.dispatchEvent({
					type: 'dblclick',
					mouse: this.mouse,
					object: hovered.object,
					scissorZoneIdx: i,
				});
				consumed = true;
				break;
			}
		}

		if (!consumed) {
			for (let inputListener of this.getSortedListeners()) {
				inputListener.dispatchEvent({
					type: 'dblclick',
					mouse: this.mouse,
					object: null,
					scissorZoneIdx: i,
				});
			}
		}

		e.preventDefault();
	}

	onMouseClick (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onMouseClick');

		e.preventDefault();
	}

	onMouseDown (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onMouseDown');

		e.preventDefault();

		let consumed = false;
		let consume = () => { return consumed = true; };

		let rect = this.domElement.getBoundingClientRect();
		let x = e.clientX - rect.left;
		let y = -(e.clientY - rect.bottom);

		// Backwards loop so if two canvases are overlapping, the last rendered one (the one on top) catches the click.
		let i;
		for (i = this.viewer.scissorZones.length - 1; i >= 0; i--) {
			if (!this.viewer.scissorZones[i].visible) continue;
			const scissor = this.viewer.getScissor(i);
			if (
				x >= scissor.x &&
				y >= scissor.y &&
				x <= scissor.x + scissor.width &&
				y <= scissor.y + scissor.height
			)
				break;
		}

		if (this.hoveredElements.length === 0) {
			for (let inputListener of this.getSortedListeners()) {
				inputListener.dispatchEvent({
					type: 'mousedown',
					viewer: this.viewer,
					mouse: this.mouse,
					scissorZoneIdx: i,
				});
			}
		}else{
			for(let hovered of this.hoveredElements){
				let object = hovered.object;
				object.dispatchEvent({
					type: 'mousedown',
					viewer: this.viewer,
					consume: consume,
					scissorZoneIdx: i,
				});

				if(consumed){
					break;
				}
			}
		}

		if (!this.drag) {
			let target = this.hoveredElements
				.find(el => (
					el.object._listeners &&
					el.object._listeners['drag'] &&
					el.object._listeners['drag'].length > 0));

			if (target) {
				this.startDragging(target.object, {location: target.point}, i);
			} else {
				this.startDragging(null, null, i);
			}
		}

		if (this.scene) {
			this.viewStart = this.scene.view.clone();
		}
	}

	onMouseUp (e) {
		if (this.logMessages) console.log(this.constructor.name + ': onMouseUp');

		e.preventDefault();

		let noMovement = this.getNormalizedDrag().length() === 0;

		
		let consumed = false;
		let consume = () => { return consumed = true; };
		if (this.hoveredElements.length === 0) {
			for (let inputListener of this.getSortedListeners()) {
				inputListener.dispatchEvent({
					type: 'mouseup',
					viewer: this.viewer,
					mouse: this.mouse,
					consume: consume
				});

				if(consumed){
					break;
				}
			}
		}else{
			let hovered = this.hoveredElements
				.map(e => e.object)
				.find(e => (e._listeners && e._listeners['mouseup']));
			if(hovered){
				hovered.dispatchEvent({
					type: 'mouseup',
					viewer: this.viewer,
					consume: consume
				});
			}
		}

		if (this.drag) {
			if (this.drag.object) {
				if (this.logMessages) console.log(`${this.constructor.name}: drop ${this.drag.object.name}`);
				this.drag.object.dispatchEvent({
					type: 'drop',
					drag: this.drag,
					viewer: this.viewer,
					scissorZoneIdx: this.drag.scissorZoneIdx,
				});
			} else {
				for (let inputListener of this.getSortedListeners()) {
					inputListener.dispatchEvent({
						type: 'drop',
						drag: this.drag,
						viewer: this.viewer,
						scissorZoneIdx: this.drag.scissorZoneIdx,
					});
				}
			}

			// check for a click
			let clicked = this.hoveredElements.map(h => h.object).find(v => v === this.drag.object) !== undefined;
			if(clicked){
				if (this.logMessages) console.log(`${this.constructor.name}: click ${this.drag.object.name}`);
				this.drag.object.dispatchEvent({
					type: 'click',
					viewer: this.viewer,
					consume: consume,
				});
			}

			this.drag = null;
		}

		if(!consumed){
			if (e.button === THREE.MOUSE.LEFT) {
				if (noMovement) {
					let selectable = this.hoveredElements
						.find(el => el.object._listeners && el.object._listeners['select']);

					if (selectable) {
						selectable = selectable.object;

						if (this.isSelected(selectable)) {
							this.selection
								.filter(e => e !== selectable)
								.forEach(e => this.toggleSelection(e));
						} else {
							this.deselectAll();
							this.toggleSelection(selectable);
						}
					} else {
						this.deselectAll();
					}
				}
			} else if ((e.button === THREE.MOUSE.RIGHT) && noMovement) {
				this.deselectAll();
			}
		}
	}

	onMouseMove (e) {
		e.preventDefault();

		let rect = this.domElement.getBoundingClientRect();
		let x = e.clientX - rect.left;
		let y = e.clientY - rect.top;
		this.mouse.set(x, y);

		let hoveredElements = this.getHoveredElements();
		if(hoveredElements.length > 0){
			let names = hoveredElements.map(h => h.object.name).join(", ");
			if (this.logMessages) console.log(`${this.constructor.name}: onMouseMove; hovered: '${names}'`);
		}

		if (this.drag) {
			this.drag.mouse = e.buttons;

			this.drag.lastDrag.x = x - this.drag.end.x;
			this.drag.lastDrag.y = y - this.drag.end.y;

			this.drag.end.set(x, y);

			if (this.drag.object) {
				if (this.logMessages) console.log(this.constructor.name + ': drag: ' + this.drag.object.name);
				this.drag.object.dispatchEvent({
					type: 'drag',
					drag: this.drag,
					viewer: this.viewer
				});
			} else {
				if (this.logMessages) console.log(this.constructor.name + ': drag: ');

				let dragConsumed = false;
				for (let inputListener of this.getSortedListeners()) {
					inputListener.dispatchEvent({
						type: 'drag',
						drag: this.drag,
						viewer: this.viewer,
						consume: () => {dragConsumed = true;}
					});

					if(dragConsumed){
						break;
					}
				}
			}
		}else{
			let curr = hoveredElements.map(a => a.object).find(a => true);
			let prev = this.hoveredElements.map(a => a.object).find(a => true);

			if(curr !== prev){
				if(curr){
					if (this.logMessages) console.log(`${this.constructor.name}: mouseover: ${curr.name}`);
					curr.dispatchEvent({
						type: 'mouseover',
						object: curr,
					});
				}
				if(prev){
					if (this.logMessages) console.log(`${this.constructor.name}: mouseleave: ${prev.name}`);
					prev.dispatchEvent({
						type: 'mouseleave',
						object: prev,
					});
				}
			}

			if(hoveredElements.length > 0){
				let object = hoveredElements
					.map(e => e.object)
					.find(e => (e._listeners && e._listeners['mousemove']));
				
				if(object){
					object.dispatchEvent({
						type: 'mousemove',
						object: object
					});
				}
			}

		}
		
		// for (let inputListener of this.getSortedListeners()) {
		// 	inputListener.dispatchEvent({
		// 		type: 'mousemove',
		// 		object: null
		// 	});
		// }
		

		this.hoveredElements = hoveredElements;
	}
	
	onMouseWheel(e){
		if(!this.enabled) return;

		if(this.logMessages) console.log(this.constructor.name + ": onMouseWheel");
		
		e.preventDefault();

		let delta = 0;
		if (e.wheelDelta !== undefined) { // WebKit / Opera / Explorer 9
			delta = e.wheelDelta;
		} else if (e.detail !== undefined) { // Firefox
			delta = -e.detail;
		}

		let ndelta = Math.sign(delta);

		// this.wheelDelta += Math.sign(delta);

		let rect = this.domElement.getBoundingClientRect();
		let x = e.clientX - rect.left;
		let y = -(e.clientY - rect.bottom);
		let width = rect.right - rect.left;
		let height = rect.top - rect.bottom;

		// Backwards loop so if two canvases are overlapping, the last rendered one (the one on top) catches the scroll.
		let i;
		for (i = this.viewer.scissorZones.length - 1; i >= 0; i--) {
			if (!this.viewer.scissorZones[i].visible) continue;
			const scissor = this.viewer.getScissor(i);
			if (
				x >= scissor.x &&
				y >= scissor.y &&
				x <= scissor.x + scissor.width &&
				y <= scissor.y + scissor.height
			)
				break;
		}

		// Added "buttons" to access the currently held mousebuttons in a scroll event.
		if (this.hoveredElement) {
			this.hoveredElement.object.dispatchEvent({
				type: 'mousewheel',
				delta: ndelta,
				buttons: e.buttons,
				object: this.hoveredElement.object,
				scissorZoneIdx: i,
			});
		} else {
			for (let inputListener of this.getSortedListeners()) {
				inputListener.dispatchEvent({
					type: 'mousewheel',
					delta: ndelta,
					buttons: e.buttons,
					object: null,
					scissorZoneIdx: i,
				});
			}
		}
	}

	startDragging (object, args = null, scissorZoneIdx = 0) {

		let name = object ? object.name : "no name";
		if (this.logMessages) console.log(`${this.constructor.name}: startDragging: '${name}'`);

		this.drag = {
			start: this.mouse.clone(),
			end: this.mouse.clone(),
			lastDrag: new THREE.Vector2(0, 0),
			startView: this.scene.view.clone(),
			object: object,
			scissorZoneIdx: scissorZoneIdx,
		};

		if (args) {
			for (let key of Object.keys(args)) {
				this.drag[key] = args[key];
			}
		}
	}

	getMousePointCloudIntersection (mouse) {
		return Utils.getMousePointCloudIntersection(
			this.mouse, 
			this.scene.getActiveCamera(), 
			this.viewer, 
			this.scene.pointclouds);
	}

	toggleSelection (object) {
		let oldSelection = this.selection;

		let index = this.selection.indexOf(object);

		if (index === -1) {
			this.selection.push(object);
			object.dispatchEvent({
				type: 'select'
			});
		} else {
			this.selection.splice(index, 1);
			object.dispatchEvent({
				type: 'deselect'
			});
		}

		this.dispatchEvent({
			type: 'selection_changed',
			oldSelection: oldSelection,
			selection: this.selection
		});
	}

	deselect(object){

		let oldSelection = this.selection;

		let index = this.selection.indexOf(object);

		if(index >= 0){
			this.selection.splice(index, 1);
			object.dispatchEvent({
				type: 'deselect'
			});

			this.dispatchEvent({
				type: 'selection_changed',
				oldSelection: oldSelection,
				selection: this.selection
			});
		}
	}

	deselectAll () {
		for (let object of this.selection) {
			object.dispatchEvent({
				type: 'deselect'
			});
		}

		let oldSelection = this.selection;

		if (this.selection.length > 0) {
			this.selection = [];
			this.dispatchEvent({
				type: 'selection_changed',
				oldSelection: oldSelection,
				selection: this.selection
			});
		}
	}

	isSelected (object) {
		let index = this.selection.indexOf(object);

		return index !== -1;
	}

	registerInteractiveObject(object){
		this.interactiveObjects.add(object);
	}

	removeInteractiveObject(object){
		this.interactiveObjects.delete(object);
	}

	registerInteractiveScene (scene) {
		let index = this.interactiveScenes.indexOf(scene);
		if (index === -1) {
			this.interactiveScenes.push(scene);
		}
	}

	unregisterInteractiveScene (scene) {
		let index = this.interactiveScenes.indexOf(scene);
		if (index > -1) {
			this.interactiveScenes.splice(index, 1);
		}
	}

	getHoveredElement () {
		let hoveredElements = this.getHoveredElements();
		if (hoveredElements.length > 0) {
			return hoveredElements[0];
		} else {
			return null;
		}
	}

	getHoveredElements () {
		let intersections = [];
		for (let i = 0; i < this.viewer.scissorZones.length; i++) {
			if (!this.viewer.scissorZones[i].visible) continue;
			let scenes = this.interactiveScenes.concat(
				this.viewer.scissorZones[i].scene.scene
			);

			let interactableListeners = ['mouseup', 'mousemove', 'mouseover', 'mouseleave', 'drag', 'drop', 'click', 'select', 'deselect'];
			let interactables = [];
			for (let scene of scenes) {
				scene.traverseVisible(node => {
					if (node._listeners && node.visible && !this.blacklist.has(node)) {
						let hasInteractableListener = interactableListeners.filter((e) => {
							return node._listeners[e] !== undefined;
						}).length > 0;

						if (hasInteractableListener) {
							interactables.push(node);
						}
					}
				});
			}
		
			let camera = this.viewer.getCamera(i);
			let ray = Utils.mouseToRay(
				this.mouse,
				camera, 
				this.domElement.clientWidth,
				this.domElement.clientHeight,
				this.viewer.getScissor(i),
				this.viewer.getViewport(i)
			);

			if (ray) {
				let raycaster = new THREE.Raycaster();
				raycaster.ray.set(ray.origin, ray.direction);
				raycaster.params.Line.threshold = 0.2;

				intersections.push(raycaster.intersectObjects(interactables.filter(o => o.visible), false));
			}
		}
		return intersections.flat();
	}

	setScene (scene) {
		this.deselectAll();

		this.scene = scene;
	}

	update (delta) {

	}

	getNormalizedDrag () {
		if (!this.drag) {
			return new THREE.Vector2(0, 0);
		}

		let diff = new THREE.Vector2().subVectors(this.drag.end, this.drag.start);

		diff.x = diff.x / this.domElement.clientWidth;
		diff.y = diff.y / this.domElement.clientHeight;

		return diff;
	}

	getNormalizedLastDrag () {
		if (!this.drag) {
			return new THREE.Vector2(0, 0);
		}

		let lastDrag = this.drag.lastDrag.clone();

		lastDrag.x = lastDrag.x / this.domElement.clientWidth;
		lastDrag.y = lastDrag.y / this.domElement.clientHeight;

		return lastDrag;
	}
}
