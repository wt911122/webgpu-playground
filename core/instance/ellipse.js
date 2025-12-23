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
    _strokeWidth = 0;

    set cx(value) {
        this.x = value - this.w/2;
        this.updateLocalTransform();
    }

    set cy(value) {
        this.y = value - this.h/2;
        this.updateLocalTransform();
    }
    
    constructor(configs) {
        super(configs);
        const { cx, cy, width, height, r, startingAngle, endingAngle, innerRadius } = configs;
        this.width = width || r*2;
        this.height = height || r*2;
        this.cx = cx ?? 0;
        this.cy = cy ?? 0;
        this.startingAngle = startingAngle ?? 0;
        this.endingAngle = endingAngle ?? Math.PI*2;
        this.innerRadius = innerRadius ?? 0;    
        this._strokeWidth = configs.strokeWidth ?? 0;
        this.updateLocalTransform()
        // this.flushTransform();
    }


    updateBoundingBox() {
        // const { x, y, w, h } = this;
        // const lc = this._localBoundingbox;
        // vec2.set(lc.LT, x-w/2, y-h/2);
        // vec2.set(lc.RB, x+w/2, y+h/2);
        // vec2.set(lc.LB, x-w/2, y+h/2);
        // vec2.set(lc.RT, x+w/2, y-h/2);

        /* const { w, h } = this;
        const lc = this._localBoundingbox;
        vec2.set(lc.LT, -w/2, -h/2);
        vec2.set(lc.RB, +w/2, +h/2);
        vec2.set(lc.LB, -w/2, +h/2);
        vec2.set(lc.RT, +w/2, -h/2);*/

        const { x, y, w, h } = this;
        const lc = this._localBoundingbox;
        vec2.set(lc.LT, 0, 0);
        vec2.set(lc.RB, w, h);
        vec2.set(lc.LB, 0, h);
        vec2.set(lc.RT, w, 0);

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
        
        let normx = ((this._tempP[0] - halfWidth) / halfWidth);
        let normy = ((this._tempP[1] - halfHeight) / halfHeight);

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
        const { cp, vecDelta, vecDeltaP, bounding, scale, position, localMat, localUnitMat } = context;
        let factor;
        if(cp === 'lt') {
            factor = [-1, -1]
            vec2.multiply(vecDelta, vecDelta, [-1,-1])
        }
        if(cp === 'rt') {
            factor = [0, -1]
            vec2.multiply(vecDelta, vecDelta, [1,-1])
        }
        if(cp === 'rb') {
            factor = [0, 0]
        }
        if(cp === 'lb') {
            factor = [-1, 0]
            vec2.multiply(vecDelta, vecDelta, [-1,1])
        }

        const width = bounding[0] + vecDelta[0];
        const height = bounding[1] + vecDelta[1];
        // console.log(width, height)
        this.w = width;
        this.h = height;
        // console.log(vecDelta)
        vec2.multiply(vecDelta, vecDelta, factor)
        vec2.transformMat3(this._tempVec, vecDelta, localUnitMat);
        vec2.add(this.position, position, this._tempVec);

        this.updateLocalTransform();
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
        if(this._strokeLineDash.length > 1) {
            this.markGeoDirty()
        }
    }

    editBoundaryEnd(context) {
        // 平移 pivot
        const newPivot = vec2.fromValues(this.w/2, this.h/2);
        const _localTransform = this._localTransform;
        const a = _localTransform[0];
        const b = _localTransform[1];
        const c = _localTransform[3];
        const d = _localTransform[4];
        const tx = _localTransform[6];
        const ty = _localTransform[7];
        const currentPivot = this._pivot;
        const origin = this._origin;
        const position = this._position;
        const cx = a * currentPivot[0] + c * currentPivot[1] - currentPivot[0];
        const cy = b * currentPivot[0] + d * currentPivot[1] - currentPivot[1];
        const ncx = a * newPivot[0] + c * newPivot[1] - newPivot[0];
        const ncy = b * newPivot[0] + d * newPivot[1] - newPivot[1];
        this._position[0] = position[0] - cx + ncx;
        this._position[1] = position[1] - cy + ncy;
        this.pivot = newPivot;
        this.updateLocalTransform();
        this.updateWorldMatrix(this.parent.matrix);
        this.markMaterialDrity();
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

    getShapeConfig() {
        const { 
            w, h, 
            startingAngle, endingAngle, innerRadius, texture,
            _strokeWidth, _zIndex, _currentMat, _colors, _opacity,
            _shadowOffsetX, _shadowOffsetY, _shadowBlur
        } = this;
        return {
            x:w/2, y:h/2,
            w, h, startingAngle, endingAngle, innerRadius,
            strokeWidth: { 
                left: _strokeWidth,
                top: _strokeWidth,
                right: _strokeWidth,
                bottom: _strokeWidth,
            },
            _opacity,
            _zIndex, 
            texture,
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
