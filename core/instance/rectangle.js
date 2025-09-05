import Layer from '../layer/layer';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';

class Rectangle extends Layer {
    static type = 1;
    w = 0;
    h = 0;
    borderRadius = 0;

    constructor(configs) {
        super(configs);
        const { cx, cy, width, height, borderRadius } = configs;
        this.w = width;
        this.h = height;
        this.borderRadius = borderRadius
        mat3.translate(this._localTransform, this._localTransform, [cx, cy]);
    }

    updateBoundingBox() {
        const { w, h } = this;

        const { LT, RB } = this._boundingbox;
        mat3.multiply(this._currentMat, this._worldTransform, this._localTransform)

        vec2.transformMat3(LT, [-w/2, -h/2], this._currentMat)
        vec2.transformMat3(RB, [w/2, h/2], this._currentMat);
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    checkHit(mouseVec) {
        // const mat = this._currentMat;
        const { _anchor, _currentMat } = this;
        vec2.transformMat3(_anchor, [0, 0], _currentMat);
        const half_w = this.w/2;
        const half_h = this.h/2
        const res = isPointInRoundedRectangle(
            mouseVec[0], mouseVec[1], 
            _anchor[0] - half_w, _anchor[1] - half_h, 
            _anchor[0] + half_w, _anchor[1] + half_h, this.borderRadius);
        // const dist = Math.hypot(mouseVec[0] - _anchor[0], mouseVec[1] - _hitvec[1]);
        return res;
    }

    getShapeConfig() {
        const { 
            w, h, _strokeWidth, _zIndex, _currentMat, 
            _colors, borderRadius, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
            _strokeLineDash
         } = this;
        return {
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
        const hw = w/2;
        const hh = h/2;
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
                painter: 'SDFPainter',
                configGetter: 'getShapeConfig'
            }, 
            {
                ctor: Rectangle,
                condition: (instance) => instance._strokeWidth > 0 && instance._strokeLineDash.length > 0,
                painter: 'PolylinePainter',
                configGetter: 'getDashedBorderConfig',
                instanced: true,
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