

import * as THREE from "../libs/three.js/build/three.module.js";
import {Action} from "./Actions.js";
import {Utils} from "./utils.js";
import {EventDispatcher} from "./EventDispatcher.js";

export class Annotation extends EventDispatcher {
	constructor (args = {}) {
		super();

		this._id = args.id || '';
		this.scene = null;
		this._title = args.title || '';
		this._description = args.description || '';
		this.offset = new THREE.Vector3();
		this.uuid = THREE.Math.generateUUID();
		this.scaleX = args.scaleX || 1.0;
		this.scaleY = args.scaleY || 1.0;
		this.shape = args.shape || "cloud";
		this.color = args.color || "ff0000";

		// set position
		if (!args.position) {
			this.position = null;
		} else if (args.position.x != null) {
			this.position = args.position;
		} else {
			this.position = new THREE.Vector3(...args.position);
		}

		// Captured View
		this.cameraPosition = (args.cameraPosition instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraPosition) : args.cameraPosition;
		this.cameraRotation = (args.cameraRotation instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraRotation) : args.cameraRotation;
		this.cameraScale = (args.cameraScale instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraScale) : args.cameraScale;
		this.cameraTarget = (args.cameraTarget instanceof Array)
			? new THREE.Vector3().fromArray(args.cameraTarget) : args.cameraTarget;
			
		this.radius = args.radius;
		this.view = args.view || null;
		this.keepOpen = false;
		this.descriptionVisible = false;
		this.showDescription = true;
		this.actions = args.actions || [];
		this.isHighlighted = false;
		this._visible = false;
		this.__visible = true;
		this._display = true;
		this._expand = false;
		this.collapseThreshold = [args.collapseThreshold, 100].find(e => e !== undefined);

		this.children = [];
		this.parent = null;
		this.boundingBox = new THREE.Box3();

		let iconClose = exports.resourcePath + '/icons/close.svg';

		if (this.shape == "cloud") {
			this.domElement = $(`
				<div class="annotation" oncontextmenu="return false;">
					<svg class="annotation-titlebar" width="2.2rem" height="2.0rem" viewBox="0 0 40 40">
						<path d="M22.368 8.682a9.005 9.005 0 0 1 8.997 8.997l-.005.084q-.007.1-.01.2l-.034 1.36 1.363.005a6.006 6.006 0 0 1 5.979 5.996 
							6.013 6.013 0 0 1-5.966 5.995l-.292.002H8.002a6.675 6.675 0 0 1-6.658-6.663 6.67 6.67 0 0 1 4.504-6.3l.75-.256.133-.782a3.983 
							3.983 0 0 1 5.725-2.897l1.215.61.587-1.227c1.49-3.114 4.673-5.125 8.11-5.125zm0-1.333a10.33 10.33 0 0 0-9.313 5.882 5.25 5.25 
							0 0 0-2.389-.57 5.325 5.325 0 0 0-5.25 4.438 7.993 7.993 0 0 0 2.585 
							15.555l24.695-.002a7.329 7.329 0 0 0-.015-14.656c.003-.107.015-.21.015-.317 0-5.705-4.625-10.329-10.329-10.329z"
							fill="#${this.color}" stroke="#${this.color}"
						/>
						<text class="annotation-label" x="0.35rem" y="1.8rem" />
					</svg>
					<div class="annotation-description">
						<span class="annotation-description-close">
							<img src="${iconClose}" width="16px">
						</span>
						<div class="annotation-title-content"><strong>${this._title}</strong></div>
						<div class="annotation-description-content">${this._description}</div>
					</div>
				</div>
			`);
		} else {
			this.domElement = $(`
				<div class="annotation" oncontextmenu="return false;">
					<svg class="annotation-titlebar" width="2.2rem" height="2.0rem" viewBox="0 -5 35 35">
						<path d="M4.5 0H0.5C0.223858 0 0 0.223858 0 0.5V4.5C0 4.70223 0.121821 4.88455 0.308658 4.96194C0.495495 5.03933 0.710554 
							4.99655 0.853553 4.85355L2.5 3.20711L14.1464 14.8536L14.8536 14.1464L3.20711 2.5L4.85355 0.853553C4.99655 0.710554 5.03933 
							0.495495 4.96194 0.308658C4.88455 0.121821 4.70223 0 4.5 0Z" 
							fill="#${this.color}" stroke="#${this.color}"
						/>
						<text class="annotation-label" x="0.35rem" y="1.8rem" />
					</svg>
					<div class="annotation-description">
						<span class="annotation-description-close">
							<img src="${iconClose}" width="16px">
						</span>
						<div class="annotation-title-content"><strong>${this._title}</strong></div>
						<div class="annotation-description-content">${this._description}</div>
					</div>
				</div>
			`);
		}
		// } else {
		// 	// Dot
		// 	this.domElement = $(`
		// 		<div class="annotation" oncontextmenu="return false;">
		// 			<div class="annotation-titlebar">
		// 				<span class="annotation-label"></span>
		// 			</div>
		// 			<div class="annotation-description">
		// 				<span class="annotation-description-close">
		// 					<img src="${iconClose}" width="16px">
		// 				</span>
		// 				<div class="annotation-title-content"><strong>${this._title}</strong></div>
		// 				<div class="annotation-description-content">${this._description}</div>
		// 			</div>
		// 		</div>
		// 	`);
		// }

		this.elTitlebar = this.domElement.find('.annotation-titlebar');
		this.elTitle = this.elTitlebar.find('.annotation-label');
		this.elTitle.append(this._id);
		this.elDescription = this.domElement.find('.annotation-description');
		this.elDescriptionClose = this.elDescription.find('.annotation-description-close');
		// this.elDescriptionContent = this.elDescription.find(".annotation-description-content");

		// this.clickTitle = args.onClick;

		this.toggleVisible = (state) => {
			this._visible = state;
		};

		this.setScale = (x, y) => {
			this.scaleX = x;
			this.scaleY = y;

			this.elTitlebar.css("transform", `scale(${this.scaleX}, ${this.scaleY})`);

			this.dispatchEvent({
				type: "annotation_changed",
				annotation: this,
			});
		}

		this.setShape = (shape) => {
			this.shape = shape;

			let path = this.domElement.find('path')[0];
			if (shape == "cloud") {
				path.setAttribute("d", `M22.368 8.682a9.005 9.005 0 0 1 8.997 8.997l-.005.084q-.007.1-.01.2l-.034 1.36 1.363.005a6.006 6.006 0 0 1 5.979 5.996 
							6.013 6.013 0 0 1-5.966 5.995l-.292.002H8.002a6.675 6.675 0 0 1-6.658-6.663 6.67 6.67 0 0 1 4.504-6.3l.75-.256.133-.782a3.983 
							3.983 0 0 1 5.725-2.897l1.215.61.587-1.227c1.49-3.114 4.673-5.125 8.11-5.125zm0-1.333a10.33 10.33 0 0 0-9.313 5.882 5.25 5.25 
							0 0 0-2.389-.57 5.325 5.325 0 0 0-5.25 4.438 7.993 7.993 0 0 0 2.585 
							15.555l24.695-.002a7.329 7.329 0 0 0-.015-14.656c.003-.107.015-.21.015-.317 0-5.705-4.625-10.329-10.329-10.329z`);
			} else if (shape == "arrow") {
				path.setAttribute("d", `M4.5 0H0.5C0.223858 0 0 0.223858 0 0.5V4.5C0 4.70223 0.121821 4.88455 0.308658 4.96194C0.495495 5.03933 0.710554 
							4.99655 0.853553 4.85355L2.5 3.20711L14.1464 14.8536L14.8536 14.1464L3.20711 2.5L4.85355 0.853553C4.99655 0.710554 5.03933 
							0.495495 4.96194 0.308658C4.88455 0.121821 4.70223 0 4.5 0Z`);
			} else {
				// do nothing
			}

			this.dispatchEvent({
				type: "annotation_changed",
				annotation: this,
			});
		};

		this.setColor = (color) => {
			this.color = color;

			let path = this.domElement.find('path')[0];
			path.setAttribute("fill", `#${this.color}`);
			path.setAttribute("stroke", `#${this.color}`);

			this.dispatchEvent({
				type: "annotation_changed",
				annotation: this,
			});
		};

		this.setTitle = (title) => {
			if (this._title === title) {
				return;
			}

			this._title = title;
			const elDescriptionContent = this.elDescription.find(".annotation-title-content");
			elDescriptionContent.empty();
			elDescriptionContent.append(`<strong>${this._title}</strong>`);

			this.dispatchEvent({
				type: "annotation_changed",
				annotation: this,
			});
		};

		this.setDescription = (description) => {
			if (this._description === description) {
				return;
			}

			this._description = description;

			const elDescriptionContent = this.elDescription.find(".annotation-description-content");
			elDescriptionContent.empty();
			elDescriptionContent.append(this._description);

			this.dispatchEvent({
				type: "annotation_changed",
				annotation: this,
			});
		};

		this.clickTitle = () => {
			if(this.hasView()){
				this.moveHere(this.scene.getActiveCamera());
			}
			this.dispatchEvent({type: 'click', target: this});
		};

		this.elTitle.click(this.clickTitle);

		this.actions = this.actions.map(a => {
			if (a instanceof Action) {
				return a;
			} else {
				return new Action(a);
			}
		});

		for (let action of this.actions) {
			action.pairWith(this);
		}

		let actions = this.actions.filter(
			a => a.showIn === undefined || a.showIn.includes('scene'));

		for (let action of actions) {
			let elButton = $(`<img src="${action.icon}" class="annotation-action-icon">`);
			this.elTitlebar.append(elButton);
			elButton.click(() => action.onclick({annotation: this}));
		}

		this.elDescriptionClose.hover(
			e => this.elDescriptionClose.css('opacity', '1'),
			e => this.elDescriptionClose.css('opacity', '0.5')
		);
		this.elDescriptionClose.click(e => this.setHighlighted(false));
		// this.elDescriptionContent.html(this._description);

		this.domElement.mouseenter(e => this.setHighlighted(true));
		this.domElement.mouseleave(e => this.setHighlighted(false));

		this.domElement.on('touchstart', e => {
			this.setHighlighted(!this.isHighlighted);
		});

		this.display = false;
		//this.display = true;

	}

	installHandles(viewer){
		if(this.handles !== undefined){
			return;
		}

		let domElement = $(`
			<div style="position: absolute; left: 300; top: 200; pointer-events: none">
				<svg width="300" height="600">
					<line x1="0" y1="0" x2="1200" y2="200" style="stroke: black; stroke-width:2" />
					<circle cx="50" cy="50" r="4" stroke="black" stroke-width="2" fill="gray" />
					<circle cx="150" cy="50" r="4" stroke="black" stroke-width="2" fill="gray" />
				</svg>
			</div>
		`);
		
		let svg = domElement.find("svg")[0];
		let elLine = domElement.find("line")[0];
		let elStart = domElement.find("circle")[0];
		let elEnd = domElement.find("circle")[1];

		let setCoordinates = (start, end) => {
			elStart.setAttribute("cx", `${start.x}`);
			elStart.setAttribute("cy", `${start.y}`);

			elEnd.setAttribute("cx", `${end.x}`);
			elEnd.setAttribute("cy", `${end.y}`);

			elLine.setAttribute("x1", start.x);
			elLine.setAttribute("y1", start.y);
			elLine.setAttribute("x2", end.x);
			elLine.setAttribute("y2", end.y);

			let box = svg.getBBox();
			svg.setAttribute("width", `${box.width}`);
			svg.setAttribute("height", `${box.height}`);
			svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);

			let ya = start.y - end.y;
			let xa = start.x - end.x;

			if(ya > 0){
				start.y = start.y - ya;
			}
			if(xa > 0){
				start.x = start.x - xa;
			}

			domElement.css("left", `${start.x}px`);
			domElement.css("top", `${start.y}px`);

			domElement.css("transform", `scale(${this.scaleX}, ${this.scaleY})`);

		};

		$(viewer.renderArea).append(domElement);


		let annotationStartPos = this.position.clone();
		let annotationStartOffset = this.offset.clone();

		$(this.domElement).draggable({
			start: (event, ui) => {
				annotationStartPos = this.position.clone();
				annotationStartOffset = this.offset.clone();
				$(this.domElement).find(".annotation-titlebar").css("pointer-events", "none");

				console.log($(this.domElement).find(".annotation-titlebar"));
			},
			stop: () => {
				$(this.domElement).find(".annotation-titlebar").css("pointer-events", "");
			},
			drag: (event, ui ) => {
				let renderAreaWidth = viewer.renderer.getSize(new THREE.Vector2()).width;
				//let renderAreaHeight = viewer.renderer.getSize().height;

				let diff = {
					x: ui.originalPosition.left - ui.position.left, 
					y: ui.originalPosition.top - ui.position.top
				};

				let nDiff = {
					x: -(diff.x / renderAreaWidth) * 2,
					y: (diff.y / renderAreaWidth) * 2
				};

				let camera = viewer.scene.getActiveCamera();
				let oldScreenPos = new THREE.Vector3()
					.addVectors(annotationStartPos, annotationStartOffset)
					.project(camera);

				let newScreenPos = oldScreenPos.clone();
				newScreenPos.x += nDiff.x;
				newScreenPos.y += nDiff.y;

				let newPos = newScreenPos.clone();
				newPos.unproject(camera);

				let newOffset = new THREE.Vector3().subVectors(newPos, this.position);
				this.offset.copy(newOffset);
			}
		});

		let updateCallback = () => {
			let position = this.position;
			let scene = viewer.scene;

			const renderAreaSize = viewer.renderer.getSize(new THREE.Vector2());
			let renderAreaWidth = renderAreaSize.width;
			let renderAreaHeight = renderAreaSize.height;

			let start = this.position.clone();
			let end = new THREE.Vector3().addVectors(this.position, this.offset);

			let toScreen = (position) => {
				let camera = scene.getActiveCamera();
				let screenPos = new THREE.Vector3();

				let worldView = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
				let ndc = new THREE.Vector4(position.x, position.y, position.z, 1.0).applyMatrix4(worldView);
				// limit w to small positive value, in case position is behind the camera
				ndc.w = Math.max(ndc.w, 0.1);
				ndc.divideScalar(ndc.w);

				screenPos.copy(ndc);
				screenPos.x = renderAreaWidth * (screenPos.x + 1) / 2;
				screenPos.y = renderAreaHeight * (1 - (screenPos.y + 1) / 2);

				return screenPos;
			};
			
			start = toScreen(start);
			end = toScreen(end);

			setCoordinates(start, end);

		};

		viewer.addEventListener("update", updateCallback);

		this.handles = {
			domElement: domElement,
			setCoordinates: setCoordinates,
			updateCallback: updateCallback
		};
	}

	removeHandles(viewer){
		if(this.handles === undefined){
			return;
		}

		//$(viewer.renderArea).remove(this.handles.domElement);
		this.handles.domElement.remove();
		viewer.removeEventListener("update", this.handles.updateCallback);

		delete this.handles;
	}

	get visible () {
		return this._visible;
	}

	set visible (value) {
		if (this._visible === value) {
			return;
		}

		this._visible = value;

		//this.traverse(node => {
		//	node.display = value;
		//});

		this.dispatchEvent({
			type: 'visibility_changed',
			annotation: this
		});
	}

	get display () {
		return this._display;
	}

	set display (display) {
		if (this._display === display) {
			return;
		}

		this._display = display;

		if (display) {
			// this.domElement.fadeIn(200);
			this.domElement.show();
		} else {
			// this.domElement.fadeOut(200);
			this.domElement.hide();
		}
	}

	get expand () {
		return this._expand;
	}

	set expand (expand) {
		if (this._expand === expand) {
			return;
		}

		if (expand) {
			this.display = false;
		} else {
			this.display = true;
			this.traverseDescendants(node => {
				node.display = false;
			});
		}

		this._expand = expand;
	}

	get id () {
		return this._id;
	}
	
	get title () {
		return this._title;
	}

	set title (title) {
		if (this._title === title) {
			return;
		}

		this._title = title;
		this.elTitle.empty();
		this.elTitle.append(this._title);

		this.dispatchEvent({
			type: "annotation_changed",
			annotation: this,
		});
	}

	get description () {
		return this._description;
	}

	set description (description) {
		if (this._description === description) {
			return;
		}

		this._description = description;

		const elDescriptionContent = this.elDescription.find(".annotation-description-content");
		elDescriptionContent.empty();
		elDescriptionContent.append(this._description);

		this.dispatchEvent({
			type: "annotation_changed",
			annotation: this,
		});
	}

	add (annotation) {
		if (!this.children.includes(annotation)) {
			this.children.push(annotation);
			annotation.parent = this;

			let descendants = [];
			annotation.traverse(a => { descendants.push(a); });

			for (let descendant of descendants) {
				let c = this;
				while (c !== null) {
					c.dispatchEvent({
						'type': 'annotation_added',
						'annotation': descendant
					});
					c = c.parent;
				}
			}
		}
	}

	level () {
		if (this.parent === null) {
			return 0;
		} else {
			return this.parent.level() + 1;
		}
	}

	hasChild(annotation) {
		return this.children.includes(annotation);
	}

	remove (annotation) {
		if (this.hasChild(annotation)) {
			annotation.removeAllChildren();
			annotation.dispose();
			this.children = this.children.filter(e => e !== annotation);
			annotation.parent = null;
		}
	}

	removeAllChildren() {
		this.children.forEach((child) => {
			if (child.children.length > 0) {
				child.removeAllChildren();
			}

			this.remove(child);
		});
	}

	updateBounds () {
		let box = new THREE.Box3();

		if (this.position) {
			box.expandByPoint(this.position);
		}

		for (let child of this.children) {
			child.updateBounds();

			box.union(child.boundingBox);
		}

		this.boundingBox.copy(box);
	}

	traverse (handler) {
		let expand = handler(this);

		if (expand === undefined || expand === true) {
			for (let child of this.children) {
				child.traverse(handler);
			}
		}
	}

	traverseDescendants (handler) {
		for (let child of this.children) {
			child.traverse(handler);
		}
	}

	flatten () {
		let annotations = [];

		this.traverse(annotation => {
			annotations.push(annotation);
		});

		return annotations;
	}

	descendants () {
		let annotations = [];

		this.traverse(annotation => {
			if (annotation !== this) {
				annotations.push(annotation);
			}
		});

		return annotations;
	}

	setHighlighted (highlighted) {
		if (highlighted) {
			this.domElement.css('opacity', '0.8');
			this.elTitlebar.css('box-shadow', '0 0 5px #fff');
			this.domElement.css('z-index', '1000');

			if (this._description) {
				this.descriptionVisible = true;
				this.elDescription.fadeIn(200);
				this.elDescription.css('position', 'relative');
			}
		} else {
			this.domElement.css('opacity', '0.5');
			this.elTitlebar.css('box-shadow', '');
			this.domElement.css('z-index', '100');
			this.descriptionVisible = false;
			this.elDescription.css('display', 'none');
		}

		this.isHighlighted = highlighted;
	}

	hasView () {
		let hasPosTargetView = this.cameraTarget.x != null;
		hasPosTargetView = hasPosTargetView && this.cameraPosition.x != null;

		let hasRadiusView = this.radius !== undefined;

		let hasView = hasPosTargetView || hasRadiusView;

		return hasView;
	};

	moveHere (camera) {
		if (!this.hasView()) {
			return;
		}

		// If a default camera is set, switch to it
		if (this.cameraPosition && this.cameraRotation && this.cameraScale) {
			let transformation = {
				position: {
					x: this.cameraPosition.x,
					y: this.cameraPosition.y,
					z: this.cameraPosition.z,
				},
				rotation: {
					x: this.cameraRotation.x,
					y: this.cameraRotation.y,
					z: this.cameraRotation.z,
				},
				scale: {
					x: this.cameraScale.x,
					y: this.cameraScale.y,
					z: this.cameraScale.z,
				},
			}

			this.scene.views[0].view.transform(transformation);

			return;
		}

		let view = this.scene.view;
		let animationDuration = 500;
		let easing = TWEEN.Easing.Quartic.Out;

		let endTarget;
		if (this.cameraTarget) {
			endTarget = this.cameraTarget;
		} else if (this.position) {
			endTarget = this.position;
		} else {
			endTarget = this.boundingBox.getCenter(new THREE.Vector3());
		}

		if (this.cameraPosition) {
			let endPosition = this.cameraPosition;

			Utils.moveTo(this.scene, endPosition, endTarget);
		} else if (this.radius) {
			let direction = view.direction;
			let endPosition = endTarget.clone().add(direction.multiplyScalar(-this.radius));
			let startRadius = view.radius;
			let endRadius = this.radius;

			{ // animate camera position
				let tween = new TWEEN.Tween(view.position).to(endPosition, animationDuration);
				tween.easing(easing);
				tween.start();
			}

			{ // animate radius
				let t = {x: 0};

				let tween = new TWEEN.Tween(t)
					.to({x: 1}, animationDuration)
					.onUpdate(function () {
						view.radius = this.x * endRadius + (1 - this.x) * startRadius;
					});
				tween.easing(easing);
				tween.start();
			}
		}
	};

	dispose () {
		if (this.domElement.parentElement) {
			this.domElement.parentElement.removeChild(this.domElement);
		}
	};

	toString () {
		return 'Annotation: ' + this._title;
	}

	setPosition(position) {
		if (this.position === position) {
			return;
		}

		if (position) {
			this.position.x = position.x;
			this.position.y = position.y;
			this.position.z = position.z;

			this.dispatchEvent({
				type: "annotation_changed",
				annotation: this,
			});
		}
	}

	setCamera(transformation) {

		if (this.cameraPosition) {
			this.cameraPosition.x = transformation.position.x;
			this.cameraPosition.y = transformation.position.y;
			this.cameraPosition.z = transformation.position.z;
		}

		if (this.cameraRotation) {
			this.cameraRotation.x = transformation.rotation.x;
			this.cameraRotation.y = transformation.rotation.y;
			this.cameraRotation.z = transformation.rotation.z;
		}

		if (this.cameraScale) {
			this.cameraScale.x = transformation.scale.x;
			this.cameraScale.y = transformation.scale.y;
			this.cameraScale.z = transformation.scale.z;
		}

		this.dispatchEvent({
			type: "annotation_changed",
			annotation: this,
		});
	}

	deleteCamera() {
		// Allows camera to still zoom in to annotations when no default camera is set
		this.cameraPosition.x = this.position.x + 50;
		this.cameraPosition.y = this.position.y + 50;
		this.cameraPosition.z = this.position.z + 50;

		// Everything else can be null
		this.cameraRotation = null;
		this.cameraScale = null;

		this.dispatchEvent({
			type: "annotation_changed",
			annotation: this,
		});
	}
};
