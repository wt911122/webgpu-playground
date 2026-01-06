import { mat3, vec2 } from 'gl-matrix';
import Layer from './layer';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';

class Group extends Layer {
    name = "Group";
    renderable = false;
    lock = false;
    _mask = null;

    set width(val) {}

    set height(val) {}


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

    get mask() {
        return this._mask;
    }

    ignoreHitTest = false;

    // set width(value)
    // {
    //     const localWidth = this.getLocalBounds().width;

    //     this._setWidth(value, localWidth);
    // }

    constructor(configs = {}) {
        super(configs);
        // const { x = 0, y = 0, lock } = configs;
        this.lock = !!configs.lock;
        this.ignoreHitTest = configs.ignoreHitTest;
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

        vec2.set(this._pivot, this.width/2 + minX, this.height/2 + minY) 
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    checkHit(mouseVec) {
        // const q = this._stack.find(instance => {
        //     return instance.checkHit(mouseVec);
        // });
        // return !!q;
        if(this.ignoreHitTest) {
            return false;
        }
        return true;
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

        this.updateLocalTransform();
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
        const { cp, vecf, vect, rotation, localMat } = context;
        const pivot = this._pivot;
        
        const v1 = [vecf[0] - pivot[0], vecf[1] - pivot[1]];
        const v2 = [vect[0] - pivot[0], vect[1] - pivot[1]];
        const angleInRadians = calculateAngle(v1, v2);
        // console.log(rotation*RAD_TO_DEG, angleInRadians*RAD_TO_DEG)
        
        this.rotation = rotation + angleInRadians;
        this.updateLocalTransform();
        // vec2.set(this._origin, 0, 0);
        // this.updateLocalTransform();

        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
    }

    setMask(shape) {
        this._mask = shape;
    }

    static attachPainter() {
        return [];
    }
}

export default Group;