import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';

class Rectangle extends Shape {
    static type = 1;
    w = 0;
    h = 0;
    
    _xy = vec2.fromValues(0,0);

    borderRadius = 0;

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
        return this._xy[0];
    }

    set x(value){
        this._xy[0] = value;
    }

    get y() {
        return this._xy[1];
    }

    set y(value){
        this._xy[1] = value;
    }

    get position() {
        return this._xy;
    }

    set position(value){
        vec2.copy(this._xy, value);
    }

    constructor(configs) {
        super(configs);
        const { x, y, width, height, borderRadius } = configs;
        this.width = width;
        this.height = height;
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.borderRadius = borderRadius;
        this.flushTransform();
    }

    updateBoundingBox() {
        const { x, y, w, h } = this;
        const lc = this._localBoundingbox;
        vec2.set(lc.LT, x, y);
        vec2.set(lc.RB, x+w, y+h);
        vec2.set(lc.LB, x, y+h);
        vec2.set(lc.RT, x+w, y);

        // const { w, h } = this;
        // const lc = this._localBoundingbox;
        // vec2.set(lc.LT, 0, 0);
        // vec2.set(lc.RB, w, h);
        // vec2.set(lc.LB, 0, h);
        // vec2.set(lc.RT, w, 0);

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

        const width = this.w;
        const height = this.h;
        const x = this.x;
        const y = this.y;
        if (width <= 0 || height <= 0){
            return false;
        }

        vec2.transformMat3(this._tempP, mouseVec, this._currentMatInv);


        if (this._tempP[0] >= x && this._tempP[0] < x+width) {
            if (this._tempP[1] >= y && this._tempP[1] < y+height) {
                return true;
            }
        }

        return false;

        // const width = this.w;
        // const height = this.h;
        // if (width <= 0 || height <= 0){
        //     return false;
        // }

        // vec2.transformMat3(this._tempP, mouseVec, this._currentMatInv);


        // if (this._tempP[0] >= 0 && this._tempP[0] < width) {
        //     if (this._tempP[1] >= 0 && this._tempP[1] < height) {
        //         return true;
        //     }
        // }

        // return false;
    }

    rotateStart(context) {
        Object.assign(context, {
            rotation: this._rotation,
        });
    }

    rotate(context) {
        const { cp, vecf, vect, rotation } = context;
        // const cx = this.x+this.width/2;
        // const cy = this.y+this.height/2;
        // const v1 = [vecf[0] - cx, vecf[1] - cy];
        // const v2 = [vect[0] - cx, vect[1] - cy];

        const origin = this._origin;
        
        const v1 = [vecf[0] - origin[0], vecf[1] - origin[1]];
        const v2 = [vect[0] - origin[0], vect[1] - origin[1]];
        const angleInRadians = calculateAngle(v1, v2);
        console.log(rotation*RAD_TO_DEG, angleInRadians*RAD_TO_DEG)
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
        const { cp, vecDelta, bounding, scale, position, localMat, localUnitMat } = context;
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

        this.width = bounding[0] + vecDelta[0];
        this.height = bounding[1] + vecDelta[1];
        vec2.multiply(vecDelta, vecDelta, factor)
        vec2.transformMat3(this._tempVec, vecDelta, localUnitMat);
        vec2.add(this.position, position, this._tempVec);
        // this._updateOrigin()

        this.flushTransform();
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
    }

    getShapeConfig() {
        const { 
            x, y,
            w, h, _strokeWidth, _zIndex, _currentMat, 
            _colors, borderRadius, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
            _strokeLineDash
         } = this;
        return {
            x: x + w/2, y: y + h/2,
            w, h, borderRadius,
            _strokeWidth,
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

    flushTransform(updateFactor) {
        if(updateFactor) {
            this._updateSkew();
        }
        
        const lt = this._localTransform;
        const scale = this._scale;
        const pivot = this._pivot;
        // const origin = this._origin;
        const position = this._position;

        const sx = scale[0];
        const sy = scale[1];

        const px = pivot[0];
        const py = pivot[1];

        // const ox = -origin[0];
        // const oy = -origin[1];
        const ox = -(this.x + this.width/2);
        const oy = -(this.y + this.height/2);

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
        return [
            {
                ctor: Rectangle,
                painter: 'SDFPainter',
                configGetter: 'getShapeConfig'
            }, 
            {
                ctor: Rectangle,
                condition: (instance) => instance._strokeWidth > 0 && instance._strokeLineDash.length > 0,
                painter: 'PolylinePainter',
                configGetter: 'getDashedBorderConfig',
            }
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