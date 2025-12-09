import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';

const ZERO_WIDTH = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
}
class Rectangle extends Shape {
    static type = 1;
    w = 0;
    h = 0;

    _borderRadius = {
        topLeft: 0,
        topRight: 0,
        bottomLeft: 0,
        bottomRight: 0,
    };

    _strokeWidth = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    }

    get x() {
        return this._position[0];
    }

    set x(value){
        this._position[0] = value + this.width/2;
    }

    get y() {
        return this._position[1];
    }

    set y(value){
        this._position[1] = value + this.height/2;
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
    get position() {
        return this._position;
    }

    set position(value){
        vec2.copy(this._position, value);
    }
    get pivot() {
        return this._pivot;
    }

    set pivot(value){
        vec2.copy(this._pivot, value);
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

    set borderRadius(value) {
        if(typeof value === 'number') {
            Object.assign(this._borderRadius, {
                topLeft: value,
                topRight: value,
                bottomLeft: value,
                bottomRight: value,
            })
        }
        if(typeof value === 'object') { 
            Object.assign(this._borderRadius, {
                topLeft: value?.topLeft ?? 0,
                topRight: value?.topRight ?? 0,
                bottomLeft: value?.bottomLeft ?? 0,
                bottomRight: value?.bottomRight ?? 0,
            })
        }
    }

    get borderRadius() {
        return this._borderRadius;
    }

    set strokeWidth(value) {
        if(typeof value === 'number') {
            Object.assign(this._strokeWidth, {
                left: value,
                top: value,
                right: value,
                bottom: value,
            })
        }
        if(typeof value === 'object') { 
            Object.assign(this._strokeWidth, {
                left: value?.left ?? 0,
                top: value?.top ?? 0,
                right: value?.right ?? 0,
                bottom: value?.bottom ?? 0,
            })
        }
    }

    get strokeWidth() {
        if(this._stroke.opacity === 0) {
            return ZERO_WIDTH;
        }
        return this._strokeWidth;
    }

    constructor(configs) {
        super(configs);
        const { x, y, width, height, strokeWidth, borderRadius, rotation } = configs;
        this.width = width;
        this.height = height;
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.borderRadius = borderRadius;
        this.strokeWidth = strokeWidth;
        this.rotation = rotation ?? 0; 
        this.flushTransform(true);
    }

    updateBoundingBox() {
        const { x, y, w, h } = this;
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
        const width = this.w/2;
        const height = this.h/2;
        if (width <= 0 || height <= 0){
            return false;
        }

        vec2.transformMat3(this._tempP, mouseVec, this._currentMatInv);


        if (this._tempP[0] >= -width && this._tempP[0] < width) {
            if (this._tempP[1] >= -height && this._tempP[1] < height) {
                return true;
            }
        }
        return false;
    }

    rotateStart(context) {
        Object.assign(context, {
            rotation: this._rotation,
        });
    }

    rotate(context) {
        const { cp, vecf, vect, rotation } = context;
        const x = 0;
        const y = 0;
        
        const v1 = [vecf[0] - x, vecf[1] - y];
        const v2 = [vect[0] - x, vect[1] - y];
        const angleInRadians = calculateAngle(v1, v2);
        // console.log(rotation*RAD_TO_DEG, angleInRadians*RAD_TO_DEG)
        this.rotation = rotation + angleInRadians;
        this.flushTransform(true);
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
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
        // console.log(vecDelta)
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
            - oy;

    }


    getShapeConfig() {
        const { 
            w, h, strokeWidth, borderRadius, _zIndex, _currentMat, 
            _colors, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
            _strokeLineDash
         } = this;
        //  console.log(_zIndex);
        return {
            x:0, y:0,
            w, h, 
            borderRadius,
            strokeWidth,
            _strokeLineDash,
            _zIndex, 
            _colors, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
            type: Rectangle.type,
            mat: paddingMat3(_currentMat)
        }
    }

    getDashedBorderConfig() {
        const { 
            w, h, borderRadius,
            _strokeWidth, _zIndex, _currentMat, _colors,
            _strokeLineDash,
        } = this;
        const hw = w/2-_strokeWidth/2;
        const hh = h/2-_strokeWidth/2;
        let path;
        if(borderRadius > 0) {
            function getPointsOnCorner(x, y, a) {
                const points = [];
                for (let i = 3; i > 0; i--) {
                    const angle = (i / 4) * Math.PI/2 + a;
                    points.push(x + borderRadius*Math.cos(angle), y + borderRadius*Math.sin(angle));
                }
                return points;
            }
            path = [
                -hw, -hh+borderRadius,
                -hw, hh-borderRadius,
                ...getPointsOnCorner(-hw+borderRadius, hh-borderRadius, Math.PI/2),
                -hw+borderRadius, hh,
                hw-borderRadius, hh,
                ...getPointsOnCorner(hw-borderRadius, hh-borderRadius, 0),
                hw, hh-borderRadius,
                hw, -hh+borderRadius,
                ...getPointsOnCorner(hw-borderRadius, -hh+borderRadius, Math.PI/2*3),
                hw-borderRadius, -hh,
                -hw+borderRadius, -hh,
                ...getPointsOnCorner(-hw+borderRadius, -hh+borderRadius, Math.PI),
                -hw, -hh+borderRadius,
            ]
        } else {
            path = [
                -hw, -hh,
                -hw, hh,
                hw, hh,
                hw, -hh,
                -hw, -hh,
            ]
        }
        return {
            path,
            _strokeLineDash,
            _strokeWidth,
            _strokeAlignment: 0.5,
            _zIndex: _zIndex+0.1, 
            _colors,
            mat: paddingMat3(_currentMat)
        }
    }

    static attachPainter() {
        return [
            {
                ctor: Rectangle,
                painter: 'SDFRectPainter',
                configGetter: 'getShapeConfig'
            }, 
            // {
            //     ctor: Rectangle,
            //     condition: (instance) => instance._strokeWidth > 0 && instance._strokeLineDash.length > 0,
            //     painter: 'PolylinePainter',
            //     configGetter: 'getDashedBorderConfig',
            // }
        ];
        // painter.usePainter(Rectangle, 'SDFPainter', 'getShapeConfig');
        // if(this._strokeWidth > 0 && this._strokeLineDash.length > 0) {
        //     painter.usePainter(Rectangle, 'PolylinePainter', 'getDashedBorderConfig');
        // }
    }
}
export default Rectangle;


function isPointInRoundedRectangle(
    x, y,
    x1, y1,
    x2, y2,
    r,
) {
  // 判断点是否在矩形的四个角的圆角内
    function isInsideCorner(
        x, y,
        cornerX,
        cornerY,
        r,
    ) {
        const distance = Math.sqrt(
            Math.pow(x - cornerX, 2) + Math.pow(y - cornerY, 2),
        );
        return distance <= r;
    }

    // 判断点是否在圆角矩形内
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        // 点在矩形内部
        if (
            isInsideCorner(x, y, x1 + r, y1 + r, r) || // 左上角
            isInsideCorner(x, y, x2 - r, y1 + r, r) || // 右上角
            isInsideCorner(x, y, x2 - r, y2 - r, r) || // 右下角
            isInsideCorner(x, y, x1 + r, y2 - r, r) // 左下角
        ) {
            return true; // 点在圆角内
        }
        return !(
            x <= x1 + r ||
            x >= x2 - r || // 点在矩形的非圆角边界上
            y <= y1 + r ||
            y >= y2 - r
        );
    }
    return false; // 点不在矩形内
}