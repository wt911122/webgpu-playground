import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';

class ControlPoint extends Shape {
    static type = 0;
    w = 0;
    h = 0;

    constructor(configs) {
        super(configs);
        const { cx, cy, radius, rotateRadius, direction } = configs;
        this.w = radius * 2;
        this.h = radius * 2;;
        this.rotateRadius = rotateRadius;
        this.direction = direction;
        this.setTranslate(cx, cy);
    }

    updateBoundingBox() {
        const { w, h } = this;

        const { LT, RB } = this._boundingbox;
        vec2.transformMat3(LT, [-w/2, -h/2], this._currentMat)
        vec2.transformMat3(RB, [w/2, h/2], this._currentMat);
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    checkHit(mouseVec) {
        // const mat = this._currentMat;
        const { _anchor, _currentMat } = this;
        const r = this.w/2;
        vec2.transformMat3(_anchor, [0, 0], _currentMat);
        
        // const dist = Math.hypot(mouseVec[0] - _anchor[0], mouseVec[1] - _hitvec[1]);
        return isPointInEllipse(mouseVec[0], mouseVec[1], _anchor[0], _anchor[1], this.w/2, this.h/2);
    }

    getConfig() {
        const { 
            w, h, _strokeWidth, _zIndex, _currentMat, _colors, _shadowOffsetX, _shadowOffsetY, _shadowBlur
        } = this;
        return {
            w, h,
            _strokeWidth,
            _zIndex, 
            _colors, _shadowOffsetX, _shadowOffsetY, _shadowBlur,
            type: Ellipse.type,
            mat: paddingMat3(_currentMat)
        }
    }
    static attachPainter(painter) {
        return [
            {
                ctor: ControlPoint,
                painter: 'SDFPainter',
                configGetter: 'getConfig'
            }
        ];
    }
}
export default ControlPoint;

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
