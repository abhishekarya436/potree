import * as THREE from "../../libs/three.js/build/three.module.js";

export class View{
	constructor () {
		this.position = new THREE.Vector3(0, 0, 0);

		this.yaw = Math.PI / 4;
		this._pitch = -Math.PI / 4;
		// Added 3rd axis of rotation.
		this.roll = 0;
		// Added 2 other offsets.
		// Now pivot is able to be offset from the camera in all 3 dimensions instead of just in the forward direction.
		this.radius = 1;
		this.sideOffset = 0;
		this.upOffset = 0;

		this.maxPitch = Math.PI / 2;
		this.minPitch = -Math.PI / 2;
	}

	transform(transformation) {
		this.position.x = transformation.position.x;
		this.position.y = transformation.position.y;
		this.position.z = transformation.position.z;

		this._pitch = transformation.rotation.x;
		this.yaw = transformation.rotation.y;
		this.roll = transformation.rotation.z;

		this.radius = transformation.scale.x;
		this.sideOffset = transformation.scale.y;
		this.upOffset = transformation.scale.z;
	}

	clone () {
		let c = new View();
		c.yaw = this.yaw;
		c._pitch = this.pitch;
		c.roll = this.roll;
		c.radius = this.radius;
		c.sideOffset = this.sideOffset;
		c.upOffset = this.upOffset;
		c.maxPitch = this.maxPitch;
		c.minPitch = this.minPitch;

		return c;
	}

	get pitch () {
		return this._pitch;
	}

	set pitch (angle) {
		this._pitch = Math.max(Math.min(angle, this.maxPitch), this.minPitch);
	}

	get direction () {
		let dir = new THREE.Vector3(0, 1, 0);

		dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
		dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.yaw);
		dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.roll);

		return dir;
	}

	set direction (dir) {

		//if(dir.x === dir.y){
		if(dir.x === 0 && dir.y === 0){
			this.yaw = 0;
			this.roll = 0;
			this.pitch = Math.PI / 2 * Math.sign(dir.z);
		}else{
			let yaw = Math.atan2(dir.y, dir.x) - Math.PI / 2;
			let pitch = Math.atan2(dir.z, Math.sqrt(dir.x * dir.x + dir.y * dir.y));

			this.yaw = yaw;
			this.roll = 0;
			this.pitch = pitch;
		}
		
	}

	getPivot() {
		// Considering all three offsets in pivot access, instead of just the forward offset (radius).
		return this.position.clone()
			.add(this.getSide().multiplyScalar(this.sideOffset))
			.add(this.direction.multiplyScalar(this.radius))
			.add(this.getUp().multiplyScalar(this.upOffset));
	}

	// Sets pivot to t and shifts the camera by the same amount that the pivot was shifted, so it will still have the same rotation and pan offsets from the pivot.
	setPivot(newPivot) {
		const oldPivot = this.getPivot();
		this.position.add(newPivot.clone().sub(oldPivot));
	}

	// Sets pivot to t and rotates the camera to look directly at it.
	lookAt(t){
		let V;
		if(arguments.length === 1){
			V = new THREE.Vector3().subVectors(t, this.position);
		}else if(arguments.length === 3){
			V = new THREE.Vector3().subVectors(new THREE.Vector3(...arguments), this.position);
		}

		let radius = V.length();
		let dir = V.normalize();

		this.radius = radius;
		this.sideOffset = 0;
		this.upOffset = 0;
		this.direction = dir;
	}

	getSide () {
		let side = new THREE.Vector3(1, 0, 0);
		// Does not require applyAxisAngle(1,0,0) because it would have no effect on the vector
		side.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.yaw);
		side.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.roll);

		return side;
	}

	// New function for convenient access of the up vector to clean up duplicate code
	getUp() {
		let up = new THREE.Vector3(0, 0, 1);
		up.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
		up.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.yaw);
		up.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.roll);

		return up;
	}

	pan (x, y) {
		// Replaced some duplicates of this.direction, getSide, getUp code with the actual function calls, here and in the translate function.
		this.sideOffset -= x;
		this.upOffset -= y;

		let side = this.getSide();
		let up = this.getUp();

		let pan = side.multiplyScalar(x).add(up.multiplyScalar(y));

		this.position = this.position.add(pan);
		// this.target = this.target.add(pan);
	}

	translate (x, y, z) {
		this.sideOffset -= x;
		this.radius -= y;
		this.upOffset -= z;
		
		let dir = this.direction
		let side = this.getSide();
		let up = this.getUp();

		let t = side.multiplyScalar(x)
			.add(dir.multiplyScalar(y))
			.add(up.multiplyScalar(z));

		this.position = this.position.add(t);
	}

	translateWorld (x, y, z) {
		this.position.x += x;
		this.position.y += y;
		this.position.z += z;
	}

	setView(position, target, duration = 0, callback = null){

		let endPosition = null;
		if(position instanceof Array){
			endPosition = new THREE.Vector3(...position);
		}else if(position.x != null){
			endPosition = position.clone();
		}

		let endTarget = null;
		if(target instanceof Array){
			endTarget = new THREE.Vector3(...target);
		}else if(target.x != null){
			endTarget = target.clone();
		}
		
		const startPosition = this.position.clone();
		const startTarget = this.getPivot();

		//const endPosition = position.clone();
		//const endTarget = target.clone();

		let easing = TWEEN.Easing.Quartic.Out;

		if(duration === 0){
			this.position.copy(endPosition);
			this.lookAt(endTarget);
		}else{
			let value = {x: 0};
			let tween = new TWEEN.Tween(value).to({x: 1}, duration);
			tween.easing(easing);
			//this.tweens.push(tween);

			tween.onUpdate(() => {
				let t = value.x;

				//console.log(t);

				const pos = new THREE.Vector3(
					(1 - t) * startPosition.x + t * endPosition.x,
					(1 - t) * startPosition.y + t * endPosition.y,
					(1 - t) * startPosition.z + t * endPosition.z,
				);

				const target = new THREE.Vector3(
					(1 - t) * startTarget.x + t * endTarget.x,
					(1 - t) * startTarget.y + t * endTarget.y,
					(1 - t) * startTarget.z + t * endTarget.z,
				);

				this.position.copy(pos);
				this.lookAt(target);

			});

			tween.start();

			tween.onComplete(() => {
				if(callback){
					callback();
				}
			});
		}

	}

};
