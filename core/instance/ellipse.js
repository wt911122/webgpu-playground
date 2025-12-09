import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';


function dotProduct(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1];
}

class Ellipse extends Shape {
    static type = 2;
    w = 0;
    h = 0;
    startingAngle = 0;
    endingAngle = Math.PI*2;
    innerRadius = 0;

    set width(val) {
        this.w = val;
    }

    set height(val) {
        this.h = val;
    }

    get width() {
        return this.w;
    }

    get height() {
        return this.h;
    }
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
    
    get position() {
        return this._position;
    }

    set position(value){
        vec2.copy(this._position, value);
    }
    constructor(configs) {
        super(configs);
        const { cx, cy, width, height, r, startingAngle, endingAngle, innerRadius } = configs;
        this.w = width || r*2;
        this.h = height || r*2;
        this.x = cx ?? 0;
        this.y = cy ?? 0;
        this.startingAngle = startingAngle ?? 0;
        this.endingAngle = endingAngle ?? Math.PI*2;
        this.innerRadius = innerRadius ?? 0;    
        this.flushTransform();
    }


    updateBoundingBox() {
        // const { x, y, w, h } = this;
        // const lc = this._localBoundingbox;
        // vec2.set(lc.LT, x-w/2, y-h/2);
        // vec2.set(lc.RB, x+w/2, y+h/2);
        // vec2.set(lc.LB, x-w/2, y+h/2);
        // vec2.set(lc.RT, x+w/2, y-h/2);

        const { w, h } = this;
        const lc = this._localBoundingbox;
        vec2.set(lc.LT, -w/2, -h/2);
        vec2.set(lc.RB, +w/2, +h/2);
        vec2.set(lc.LB, -w/2, +h/2);
        vec2.set(lc.RT, +w/2, -h/2);

        const { LT, RB, LB, RT } = this._boundingbox;
        vec2.transformMat3(LT, lc.LT, this._currentMat)
        vec2.transformMat3(RB, lc.RB, this._currentMat);
        vec2.transformMat3(LB, lc.LB, this._currentMat);
        vec2.transformMat3(RT, lc.RT, this._currentMat);
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    checkHit(mouseVec) {
        // const mat = this._currentMat;
        const { w, h, _currentMatInv } = this;

        const halfWidth = w/2;
        const halfHeight = h/2;
        if (halfWidth <= 0 || halfHeight <= 0){
            return false;
        }

        vec2.transformMat3(this._tempP, mouseVec, _currentMatInv);

        // normalize the coords to an ellipse with center 0,0
        
        let normx = ((this._tempP[0]) / halfWidth);
        let normy = ((this._tempP[1]) / halfHeight);

        normx *= normx;
        normy *= normy;

        return (normx + normy <= 1);
    }

    editBoundaryStart(context) {
        const mat = this._localTransform;
        Object.assign(context, {
            scale: vec2.clone(this._scale),
            bounding: vec2.fromValues(this.width, this.height),
            position: vec2.clone(this.position),
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

        this.width = bounding[0] + vecDelta[0];
        this.height = bounding[1] + vecDelta[1];

        vec2.multiply(vecDelta, vecDelta, factor)
        vec2.transformMat3(this._tempVec, vecDelta, localUnitMat);
        vec2.add(this.position, position, this._tempVec);

        this.flushTransform();
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
        if(this._strokeLineDash.length > 1) {
            this.markGeoDirty()
        }
    }

    rotateStart(context) {
        Object.assign(context, {
            rotation: this._rotation,
        });
    }

    rotate(context) {
        const { cp, vecf, vect, rotation } = context;

        const angleInRadians = calculateAngle(vecf, vect);
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
        const position = this._position;

        // get the matrix values of the container based on its this properties..
        lt[0] = this._cx;
        lt[1] = this._sx;
        lt[3] = this._cy;
        lt[4] = this._sy;

        lt[6] = position[0];
        lt[7] = position[1];

    }

    getShapeConfig() {
        const { 
            w, h, 
            startingAngle, endingAngle, innerRadius,
            _strokeWidth, _zIndex, _currentMat, _colors, 
            _shadowOffsetX, _shadowOffsetY, _shadowBlur
        } = this;
        return {
            x:0, y:0,
            w, h, startingAngle, endingAngle, innerRadius,
            strokeWidth: { top: _strokeWidth },
            _zIndex, 
            _colors, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
            type: Ellipse.type,
            mat: paddingMat3(_currentMat)
        }
    }
    getDashedBorderConfig() {
        const { 
            w, h,
            _strokeWidth, _zIndex, _currentMat, _colors,
            _strokeLineDash,
        } = this;
        const rx = w/2;
        const ry = h/2;
        for (let i = 0; i < 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            points.push(rx * Math.cos(angle), ry * Math.sin(angle));
        }
        points.push(rx, 0);
        return {
            path: points,
            _strokeLineDash,
            _strokeWidth,
            _strokeAlignment: 0.5,
            _zIndex: _zIndex+0.1, 
            _colors,
            mat: paddingMat3(_currentMat)
        }
    }
    static attachPainter(painter) {
        return [
            {
                ctor: Ellipse,
                painter: 'SDFRectPainter',
                configGetter: 'getShapeConfig'
            }, 
            // {
            //     ctor: Ellipse,
            //     condition: (instance) => this._strokeWidth > 0 && this._strokeLineDash.length > 0,
            //     painter: 'PolylinePainter',
            //     configGetter: 'getDashedBorderConfig'
            // }
        ];
    }
}
export default Ellipse;

function isPointInEllipse( 
    x, y,
    cx, cy,
    rx, ry,
) {
  const dx = x - cx;
  const dy = y - cy;
  const squaredDistance = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

  return squaredDistance <= 1;
}
