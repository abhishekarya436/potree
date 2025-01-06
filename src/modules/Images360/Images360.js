
import * as THREE from "../../../libs/three.js/build/three.module.js";
import { EventDispatcher } from "../../EventDispatcher.js";

let sg = new THREE.SphereGeometry(1, 8, 8);
let sgHigh = new THREE.SphereGeometry(1, 128, 128);

const red = 0xff0000;
const green = 0x98F4A6;

let sm = new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: green });
let smHovered = new THREE.MeshBasicMaterial({side: THREE.BackSide, color: red});
smHovered.transparent = true;

let pm;
let pmHovered;

let clearMeshMaterial = new THREE.MeshBasicMaterial({side: THREE.BackSide});
clearMeshMaterial.transparent = true;
clearMeshMaterial.opacity = 0.6;

let raycaster = new THREE.Raycaster();

let previousView = {
	controls: null,
	position: null,
	target: null,
};

class Image360{

	constructor(file, time, longitude, latitude, altitude, course, pitch, roll){
		this.file = file;
		this.time = time;
		this.longitude = longitude;
		this.latitude = latitude;
		this.altitude = altitude;
		this.course = course;
		this.pitch = pitch;
		this.roll = roll;
		this.mesh = null;
		this.annotations= [];
	}
};

// This is file is updated by Varun Veginati. 
// "viewer" is updated with "this.viewer" since when used in cpms it can't recognise what is viewer.
// To view the changes check this pull request -> https://github.com/powernai/potree/pull/1/files

// This file is updated by Jonathan Miner.
// Access to CpmsRaycaster is given to allow all types of objects to block hovering/clicks on the images.
// Access to T60ImageManager is given so that when unfocusing, it will now make other images visible even if they did not exist at the time of focusing.
// Previously, it relied on creating a list of all images at the time of focusing, which it would make visible at the time of unfocusing.
// It also now considers multiple visibility requirements and does not show other files upon unfocusing unless they meet all requirements.
export class Images360 extends EventDispatcher{

	constructor(viewer, cpmsRaycaster, manager){
		super();

		this.focusAction = (image)=>{};
		this.unfocusAction = (image)=>{};
		this.viewer = viewer;

		this.selectingEnabled = true;

		this.images = [];
		this.pointers = [];
		this.node = new THREE.Object3D();

		this.sphere = new THREE.Mesh(sgHigh, sm);
		this.isMiniscene = false;
		this.sphere.visible = false;
		this.sphere.scale.set(1000, 1000, 1000);
		this.node.add(this.sphere);
		this._visible = true;
		this.manager = manager;
		// this.node.add(label);

		this.focusedImage = null;
		this.currentlyHovered = null;
		this.cpmsRaycaster = cpmsRaycaster;

		this.onUpdate = () => this.update(viewer);

		viewer.inputHandler.addInputListener(this);

		this.focusFunction = () => {
			if(this.currentlyHovered && this.currentlyHovered.image360) {
				// calling focus from mini scene's 360 images
				if (this.isMiniscene) {
					if (this.companionObject.focusedImage) {
						let objIdx = this.node.children.indexOf(this.currentlyHovered);
						this.companionObject.currentlyHovered = this.companionObject.node.children[objIdx];
						this.companionObject.focus(this.companionObject.currentlyHovered.image360);
					}
				} else {
					// calling focus on clicking from main 4D scene
					this.focus(this.currentlyHovered.image360);
				}
			}
		};
		
		if(!pm) {
			new THREE.TextureLoader().load(`${Potree.resourcePath}/textures/pin_white_2D.png`,(map)=>{
				pm = new THREE.SpriteMaterial({map:map, color: green});
				pm.opacity = 0.6;
				pmHovered = new THREE.SpriteMaterial({map:map, color: red});
			});
		}

		this.addEventListener("mousedown", this.focusFunction);
		this.addEventListener("touchend", this.focusFunction);
	}

	addListeners() {
		this.addEventListener("mousedown", this.focusFunction, false);
		this.addEventListener("touchend", this.focusFunction, false);
	}

	releaseListeners() {
		this.removeEventListener("mousedown", this.focusFunction, false);
		this.removeEventListener("touchend", this.focusFunction, false);
	}
	
	set visible(visible){
		if(this._visible === visible){
			return;
		}


		for(const image of this.images){
			image.mesh.visible = visible && (this.focusedImage == null);
		}

		this.sphere.visible = visible && (this.focusedImage != null);
		this._visible = visible;
		this.dispatchEvent({
			type: "visibility_changed",
			images: this,
		});
	}

	get visible(){
		return this._visible;
	}

	focus(image360){
		if(this.manager.isFocussed()){
			this.manager.showLinkedAnnotations(this.focusedImage,image360)
			this.manager.unFocus(true);
		}
		else {
			// When moving focus from one image to another, preserve the return position for the camera. Otherwise, set it from the current position.
			previousView = {};
		}
		this.manager.setSelected360(this.parent);
		this.manager.showLinkedAnnotations(this.focusedImage,image360)

		this.focusedImage = image360;

		previousView = {
			controls: previousView.controls ?? this.viewer.controls,
			position: previousView.position ?? this.viewer.scene.view.position.clone(),
			target: previousView.target ?? this.viewer.scene.view.getPivot(),
		};

		this.viewer.setControls(this.viewer.orbitControls);
		this.viewer.orbitControls.doubleClockZoomEnabled = false;

		const focusCenter = this.focusedImage.mesh.getWorldPosition();
		for(let i = 0; i < this.images.length; i++){
			const otherMesh = this.images[i].mesh;

			otherMesh.visible = false;
			if(this.focusedImage.neighbors.includes(i)) {
				const pointerSprite = new THREE.Sprite(pm);
				this.node.add(pointerSprite);
				this.pointers.push(pointerSprite);
				pointerSprite.sphere = otherMesh;
				
				const pointerScale = 0.1;
				const aspectRatio = ((image)=>image.width/image.height)(pm.map.image);
				pointerSprite.scale.set(pointerScale*aspectRatio, pointerScale, 1);
				pointerSprite.center=new THREE.Vector2(0.5,0);

				const toNeighbor = otherMesh.getWorldPosition().sub(focusCenter);
				// Lower the pointer to the ground.
				toNeighbor.z -= 1;
				// Prevent the pointer from being inside the near clipping plane or covering the screen.
				if(toNeighbor.equals(new THREE.Vector3()))
					toNeighbor.z = -1;
				if(toNeighbor.lengthSq < 1)
					toNeighbor.normalize();

				// Convert to local coordinates.
				toNeighbor.applyQuaternion(this.node.quaternion.clone().invert());
				toNeighbor.divide(this.node.scale);

				// Place pointer.
				pointerSprite.position.copy(this.focusedImage.mesh.position).add(toNeighbor);
			}
		}

		this.load(image360).then( () => {
			// Moving fast, this sphere isn't focused anymore by the time the texture loads. Dispose the texture.
			// Or, moving fast, this sphere was unfocused and refocused. Dispose the new texture and keep the old one.
			if(image360 !== this.focusedImage || (this.sphere.material !== sm && this.sphere.material !== clearMeshMaterial)) {
				image360.texture.dispose();
				return;
			}
			if(this.visible)
				this.sphere.visible = true;
			this.sphere.material = this.sphere.material.clone();
			this.sphere.material.map = image360.texture;
			this.sphere.material.needsUpdate = true;
		});
		if (!this.isMiniscene) {
			this.sphere.material = clearMeshMaterial;
		}

		{ // orientation
			let {course, pitch, roll} = image360;
			//reset orientation everytime
			this.sphere.rotation.set(0, 0, 0, 'ZYX');

			// Code for old coordinates.json files that use unit vectors. A unit vector has less degrees of freedom so it can be slightly incorrect in some cases.
			/*
			this.sphere.rotateY(MathUtils.degToRad(-90));
			this.sphere.rotateX(MathUtils.degToRad(180));
			const quat = new Quaternion().setFromUnitVectors(new Vector3(1,0,0),new Vector3(course,pitch,roll));
			this.sphere.applyQuaternion(quat);
			*/

			// Code for new coordinates.json files that use euler angles (ZYX, extrinsic, in degrees).
			this.sphere.rotation.set(THREE.MathUtils.degToRad(course), THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(roll), 'ZYX');
			this.sphere.rotateY(THREE.MathUtils.degToRad(-90));
			this.sphere.rotateX(THREE.MathUtils.degToRad(180));

			//to render at last so that its always visible ahead of BIM
			this.sphere.renderOrder = 999;
			//clearDepth removes any depthBuffer the render has so that the next object is always rendered and shown on top
			this.sphere.onBeforeRender = function (renderer) {
				renderer.clearDepth();
			};
		}

		this.sphere.position.copy(image360.mesh.position);

		//get world position instead of relative position
		let target = new THREE.Vector3();
		image360.mesh.getWorldPosition(target);
		// Keep the same facing direction when entering/switching between images.
		let dir = this.viewer.scene.view.direction.clone().normalize();
		let move = dir.multiplyScalar(0.000001);
		let newCamPos = target.clone().sub(move);

		this.viewer.scene.view.setView(
			newCamPos, 
			target,
			500
		);

		this.focusAction(image360);
	}

	unfocus(immediate = false){
		
		let image = this.focusedImage;
		this.manager.showLinkedAnnotations(this.focusedImage,null)
		if(image === null){
			return;
		}

		if(this.sphere.material !== sm && this.sphere.material !== clearMeshMaterial) {
			this.sphere.material.map.dispose();
			this.sphere.material.map = null;
			this.sphere.material.dispose();
			this.sphere.material = null;
		}

		this.pointers.forEach((pointer) => this.node.remove(pointer));
		this.pointers = [];

		this.sphere.visible = false;

		this.sphere.material = clearMeshMaterial;

		/*
		let pos = this.viewer.scene.view.position;
		let target = this.viewer.scene.view.getPivot();
		let dir = target.clone().sub(pos).normalize();
		let move = dir.multiplyScalar(10);
		let newCamPos = target.clone().sub(move);
		*/

		this.viewer.orbitControls.doubleClockZoomEnabled = true;
		this.viewer.setControls(previousView.controls);

		for(let image of this.images) {
			image.mesh.visible = true;
			image.mesh.geometry = sg;
			image.mesh.material = sm;
			image.mesh.setRotationFromEuler(new THREE.Euler(0,0,0));
			image.mesh.position.copy(image.defaultPosition);
		}
		this.focusedImage = null;

		if(!this.isMiniscene) {
			this.sphere.material = sm;
		}

		this.viewer.scene.view.setView(
			previousView.position, 
			previousView.target,
			500,
			() => {
				if(!immediate) {
					if(this.focusedImage === null) {
						if(this.visible) {
							for(let image of this.images){
								image.mesh.scale.set(1,1,1);
							}
						}
						this.selectingEnabled = true;
					}
				}
			}
		);
		if(immediate) {
			if(this.focusedImage === null) {
				if(this.visible) {
					for(let image of this.images){
						image.mesh.scale.set(1,1,1);
					}
				}
				this.selectingEnabled = true;
			}
		}

		this.unfocusAction(image);
	}
	
	setFocusAction(action=(image)=>{}) {
		this.focusAction = action;
	}
	
	setUnfocusAction(action=()=>{}) {
		this.unfocusAction = action;
	}

	load(image360){

		return new Promise(resolve => {
			let texture = new THREE.TextureLoader().load(image360.file, resolve);
			texture.wrapS = THREE.RepeatWrapping;
			texture.repeat.x = -1;

			image360.texture = texture;
		});

	}

	handleHovering(viewer){
		let mouse = viewer.inputHandler.mouse;
		let domElement = viewer.renderer.domElement;

		let intersections = [];
		// Backwards loop so the last rendered zone (the one rendered on top) catches the mouse in case of overlapping canvases.
		for (let i = viewer.scissorZones.length - 1; i >= 0; i--) {
			// Find correct scissor zone.
			if (
				!viewer.scissorZones[i].visible ||
				!viewer.scissorZones[i].scene.images360.includes(this)
			)
				continue;
			if(i == 0 && this.cpmsRaycaster) {
				// Check if this 360image set is behind anything else.
				let resources = this.cpmsRaycaster.components.resources;
				// In focus mode, allow clicking through bim walls and other objects. But not 360 images, or else it will highlight both.
				if(this.focusedImage) {
					resources = resources.filter((x) => x.isT60Image4D);
				}
				const raycast = this.cpmsRaycaster.castRay(resources);
				if(!raycast || raycast.object !== this || viewer.navigationCube.hovered)
					break;
			}
			let camera = viewer.getCamera(i);
			let ray = Potree.Utils.mouseToRay(mouse, camera, 
				domElement.clientWidth, domElement.clientHeight,
				viewer.getScissor(i), viewer.getViewport(i)
			);
			if (ray) {
				// let tStart = performance.now();
				raycaster.ray.copy(ray);
				raycaster.camera = viewer.getCamera(i);
				// Do not hover the background sphere or spheres hidden during focus mode.
				let spheres = this.node.children.filter((sphere) => sphere.visible && sphere !== this.sphere);
				intersections.push(raycaster.intersectObjects(spheres));
			}
		}
		intersections = intersections.flat();

		const intersection = intersections[0];
		if (intersection) {
			// Highlight the pointer if applicable.
			if(intersection.object instanceof THREE.Sprite) {
				intersection.object.material = pmHovered;
				intersection.object = intersection.object.sphere;
			}
			// Highlight the same sphere on other scene if applicable. Don't highlight if zoomed into the 360 view.
			this.currentlyHovered = intersection.object;
			this.currentlyHovered.material = smHovered;
			if (this.companionObject && !this.companionObject.focusedImage && this.isMiniscene) {
				let objIdx = this.node.children.indexOf(intersection.object);
				this.companionObject.currentlyHovered = this.companionObject.node.children[objIdx];
				this.companionObject.currentlyHovered.material = smHovered;
			}
		}

		//label.visible = true;
		//label.setText(this.currentlyHovered.image360.file);
		//this.currentlyHovered.getWorldPosition(label.position);
	}

	update(){

		let {viewer} = this;

		this.pointers.forEach((pointer) => {
			pointer.material = pm;
		});

		if(this.currentlyHovered){
			this.currentlyHovered.material = sm;
			this.currentlyHovered = null;
		}

		if(this.selectingEnabled){
			this.handleHovering(viewer);
		}

		const newVisible = this.manager.shouldBeVisible(this);
		if(newVisible && !this.visible) {
			this.show();
		}
		else if(!newVisible && this.visible) {
			this.hide();
		}
		
		if(this.isMiniscene){
			const view = viewer.getView(1);
			const object = this.node;
			if(view && object) {
				// Dividing by 25 makes it seem mostly normal at the default view position of z=100.
				const scale = Math.min(1, (view.position.z - object.position.z) / (object.scale.x * 25));
				this.node.children.forEach((sphere) => 
					sphere.scale.set(scale,scale,scale)
				);
			}
		}
	}

};


export class Images360Loader{

	static async load(url, viewer, cpmsRaycaster, manager, params = {}){

		if(!params.transform){
			params.transform = {
				forward: a => a,
			};
		}
		
		// updated by Varun Veginati. This update is to use coordinates file in json format instead of txt file.
		let response = await fetch(`${url}/coordinates.json`);
		let data = await response.json();

		let lines = data.coordinates;
		// let coordinateLines = lines.slice(1);

		let images360 = new Images360(viewer, cpmsRaycaster, manager);

		for(let line of lines){

			let [filename, time, long, lat, alt, course, pitch, roll] = line;
			time = parseFloat(time);
			long = parseFloat(long);
			lat = parseFloat(lat);
			alt = parseFloat(alt);
			course = parseFloat(course);
			pitch = parseFloat(pitch);
			roll = parseFloat(roll);

			filename = filename.replace(/"/g, "");
			let file = `${url}/${filename}`;

			let image360 = new Image360(file, time, long, lat, alt, course, pitch, roll);

			let xy = params.transform.forward([long, lat]);
			let position = [...xy, alt];
			image360.position = position;

			images360.images.push(image360);
		}

		Images360Loader.setNeighbors(images360);

		Images360Loader.createSceneNodes(images360, params.transform);

		return images360;

	}

	static createSceneNodes(images360, transform){

		for(let image360 of images360.images){
			let {longitude, latitude, altitude} = image360;
			let xy = transform.forward([longitude, latitude]);

			let mesh = new THREE.Mesh(sg, sm);
			mesh.position.set(...xy, altitude);
			image360.defaultPosition = mesh.position.clone();
			mesh.scale.set(1, 1, 1);
			mesh.material.transparent = true;
			mesh.material.opacity = 0.6;
			mesh.image360 = image360;

			images360.node.add(mesh);

			image360.mesh = mesh;
		}
	}

	static setNeighbors(images360) {
		const positions = images360.images.map((image) => new THREE.Vector3(...image.position));

		// Set the max distance from an image to its neighbors.
		let distanceSqLimit = 0;
		// Setting distanceSqLimit to be the average (across all images) of the max (across images 3 in front and 3 behind) of distance squared between images.
		for(let i = 0; i < positions.length; i++) {
			let maxDistanceSq = 0;
			for(let j = i-3; j <= i+3; j++) {
				if(j >= 0 && j < positions.length) {
					maxDistanceSq = Math.max(maxDistanceSq, positions[i].distanceToSquared(positions[j]));
				}
			}
			distanceSqLimit += maxDistanceSq;
		};
		if(positions.length > 0) {
			distanceSqLimit /= positions.length;
		}

		// Set the max angle between two neighbors of an image.
		const angleCosLimit = Math.cos(Math.PI/4);

		for(let i = 0; i < positions.length; i++) {
			const neighborCandidates = [];
			const acceptedNeighbors = [];

			for(let j = 0; j < positions.length; j++) {
				if(i == j)
					continue;

				const toOther = new THREE.Vector3().subVectors(positions[j], positions[i]);

				// Adjacent items in the list are always neighbors.
				if(Math.abs(i-j) == 1) {
					acceptedNeighbors.push({idx: j, toOther, toOtherLength: toOther.length()});
					continue;
				}

				const toOtherLengthSq = toOther.lengthSq();

				// Item is too far away to be a neighbor.
				if(toOtherLengthSq > distanceSqLimit)
					continue;

				neighborCandidates.push({idx: j, toOther, toOtherLength: Math.sqrt(toOtherLengthSq)});
			}

			neighborCandidates.sort((a,b) => a.toOtherLength - b.toOtherLength);

			neighborCandidates.forEach((candidate) => {
				// dot(A,B) = cos(angle between A and B) * length(A) * length(B)
				// If angle must be > X, then dot(A,B) must be < cos(X) * length(A) * length(B)
				// temp = cos(X) * length(A).
				const temp = angleCosLimit * candidate.toOtherLength;
				let angleTooClose = false;
				for(const neighbor of acceptedNeighbors) {
					if(candidate.toOther.dot(neighbor.toOther) >= temp * neighbor.toOtherLength) {
						// If candidate's toOtherLength is 0, it gets rejected by the above condition, which is fine.
						// If neighbor's toOtherLength is 0, (only possible for abs(i-j) == 1) it would block all others from being neighbors to this one, which is not fine, so we check that.
						if(neighbor.toOtherLength != 0) {
							angleTooClose = true;
							break;
						}
					}
				}
				
				if(!angleTooClose)
					acceptedNeighbors.push(candidate);
			});

			images360.images[i].neighbors = acceptedNeighbors.map(neighbor => neighbor.idx);
		}
	}
}


