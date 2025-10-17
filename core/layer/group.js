import { mat3, vec2 } from 'gl-matrix';
import Layer from './layer';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';

class Group extends Layer {
    renderable = false;
    lock = false;

    _position   = vec2.fromValues(0,0);
    _scale      = vec2.fromValues(1,1);
    _pivot      = vec2.fromValues(0,0);
    _origin     = vec2.fromValues(0,0);
    _skew       = vec2.fromValues(0,0);
    _rotation = 0;
    _cx = 1;
    _sx = 0;
    _cy = 0;
    _sy = 1;

    _tempVec = vec2.create();

    get x() {
        return this._position[0];
    }

    set x(value){
        this._position[0] = value;
    }

    get y() {
        return this._position[1];
    }

    set y(value){
        this._position[1] = value;
    }

    get rotation() {
        return this._rotation;
    }

    set rotation(value) {
        if (this._rotation !== value) {
            this._rotation = value;
        }
    }
    get angle() {
        return this.rotation * RAD_TO_DEG;
    }

    set angle(value) {
        this.rotation = value * DEG_TO_RAD;
    }

    get pivot() {
        return this._pivot;
    }

    set pivot(value){
        vec2.copy(this._pivot, value);
    }

    get skew() {
        return this._skew;
    }

    set skew(value){
        vec2.copy(this._skew, value);
    }

    get scale() {
        return this._scale;
    }

    set scale(value){
        vec2.copy(this._scale, value);
    }

    get origin() {
        return this._origin;
    }

    set origin(value){
        vec2.copy(this._origin, value);
    }

    get position() {
        return this._position;
    }

    set position(value){
        vec2.copy(this._position, value);
    }

    get width()
    {
        const lc = this._localBoundingbox;
        return Math.abs((lc.RB[0] - lc.LT[0]));
    }

    get height()
    {
        const lc = this._localBoundingbox;
        return Math.abs((lc.RB[1] - lc.LT[1]));
    }

    // set width(value)
    // {
    //     const localWidth = this.getLocalBounds().width;

    //     this._setWidth(value, localWidth);
    // }

    constructor(configs = {}) {
        super(configs);
        // const { x = 0, y = 0, lock } = configs;
        this.lock = !!configs.lock;
    }

    updateBoundingBox() {
        // const parentTrans = this._localTransform;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const lttemp = vec2.create(); 
        const rbtemp = vec2.create();
        const lbtemp = vec2.create();
        const rttemp = vec2.create();
        this._stack.forEach(instance => {
            const lc = instance._localBoundingbox;
            const lm = instance._localTransform;
            vec2.transformMat3(lttemp, lc.LT, lm)
            vec2.transformMat3(rbtemp, lc.RB, lm);
            vec2.transformMat3(lbtemp, lc.LB, lm);
            vec2.transformMat3(rttemp, lc.RT, lm);

            minX = Math.min(lttemp[0], rbtemp[0], lbtemp[0], rttemp[0], minX);
            minY = Math.min(lttemp[1], rbtemp[1], lbtemp[1], rttemp[1], minY);
            maxX = Math.max(lttemp[0], rbtemp[0], lbtemp[0], rttemp[0], maxX);
            maxY = Math.max(lttemp[1], rbtemp[1], lbtemp[1], rttemp[1], maxY);
        });

        const lc = this._localBoundingbox;
        vec2.set(lc.LT, minX, minY);
        vec2.set(lc.RB, maxX, maxY);
        vec2.set(lc.LB, minX, maxY);
        vec2.set(lc.RT, maxX, minY);

        const { LT, RB, LB, RT } = this._boundingbox;
        vec2.transformMat3(LT, lc.LT, this._currentMat)
        vec2.transformMat3(RB, lc.RB, this._currentMat);
        vec2.transformMat3(LB, lc.LB, this._currentMat);
        vec2.transformMat3(RT, lc.RT, this._currentMat);

        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    checkHit(mouseVec) {
        // const q = this._stack.find(instance => {
        //     return instance.checkHit(mouseVec);
        // });
        // return !!q;
    }

    editBoundaryStart(context) {
        const mat = this._localTransform;
        Object.assign(context, {
            scale: vec2.clone(this._scale),
            bounding: vec2.fromValues(this.width, this.height),
            position: vec2.clone(this._position),
            localMat: mat3.clone(mat),
            localUnitMat: mat3.fromValues(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5], 0,0,1)
        })
    }

    editBoundary(context) {
        const { cp, vecDelta, bounding, scale, position, localMat, localUnitMat } = context;
        let factor;
        if(cp === 'lt') {
            factor = [-0.5, -0.5]
            vec2.multiply(vecDelta, vecDelta, [-1,-1])
        }
        if(cp === 'rt') {
            factor = [0.5, -0.5]
            vec2.multiply(vecDelta, vecDelta, [1,-1])
        }
        if(cp === 'rb') {
            factor = [0.5, 0.5]
        }
        if(cp === 'lb') {
            factor = [-0.5, 0.5]
            vec2.multiply(vecDelta, vecDelta, [-1,1])
        }

        const sw = (bounding[0] + vecDelta[0]) / bounding[0] * scale[0];
        const sh = (bounding[1] + vecDelta[1]) / bounding[1] * scale[1];
        this.scale = [sw, sh];

        vec2.multiply(vecDelta, vecDelta, factor)
        vec2.transformMat3(this._tempVec, vecDelta, localUnitMat);
        vec2.add(this.position, position, this._tempVec);

        this.flushTransform();
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
    }
    editBoundaryEnd() {

    }

    rotateStart(context) {
        Object.assign(context, {
            rotation: this._rotation,
        });
    }
    rotate(context) {
        const { cp, vecf, vect, rotation } = context;
        const pivot = this.origin;
        
        const v1 = [vecf[0] - pivot[0], vecf[1] - pivot[1]];
        const v2 = [vect[0] - pivot[0], vect[1] - pivot[1]];
        const angleInRadians = calculateAngle(v1, v2);
        console.log(rotation*RAD_TO_DEG, angleInRadians*RAD_TO_DEG)
        this.rotation = rotation + angleInRadians;
        this.flushTransform(true);
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
    }

    _updateSkew() {
        const rotation = this._rotation;
        const skew = this._skew;

        this._cx = Math.cos(rotation + skew[1]);
        this._sx = Math.sin(rotation + skew[1]);
        this._cy = -Math.sin(rotation - skew[0]); // cos, added PI/2
        this._sy = Math.cos(rotation - skew[0]); // sin, added PI/2
    }

    flushTransform(updateFactor) {
        if(updateFactor) {
            this._updateSkew();
        }
        
        const lt = this._localTransform;
        const scale = this._scale;
        const pivot = this._pivot;
        const origin = this._origin;
        const position = this._position;

        const sx = scale[0];
        const sy = scale[1];

        const px = pivot[0];
        const py = pivot[1];

        const ox = -origin[0];
        const oy = -origin[1];

        // get the matrix values of the container based on its this properties..
        lt[0] = this._cx * sx;
        lt[1] = this._sx * sx;
        lt[3] = this._cy * sy;
        lt[4] = this._sy * sy;

        lt[6] = position[0] - ((px * lt[0]) + (py * lt[3])) // Pivot offset
            + ((ox * lt[0]) + (oy * lt[3])) // Origin offset for rotation and scaling
            - ox; // Remove origin to maintain position
        lt[7] = position[1] - ((px * lt[1]) + (py * lt[4])) // Pivot offset
            + ((ox * lt[1]) + (oy * lt[4])) // Origin offset for rotation and scaling
            - oy; // Remove origin to maintain position
    }

    static attachPainter() {
        return [];
    }
}

export default Group;