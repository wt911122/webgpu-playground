import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';

class Ellipse extends Shape {
    static type = 0;
    w = 0;
    h = 0;

    constructor(configs) {
        super(configs);
        const { cx, cy, width, height, r } = configs;
        this.w = width || r*2;
        this.h = height || r*2;
        this.setTranslate(cx, cy);
    }

    // setAnchor(x, y) {
    //     this.updateLocalTransform(x, y);
    // }

    // updateLocalTransform(x, y) {
    //     mat3.identity(this._localTransform);
    //     mat3.translate(this._localTransform, this._localTransform, [x, y]);
    // }

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

    editBoundaryStart(context) {
        Object.assign(context, {
            w: this.w,
            h: this.h,
            translate: vec2.clone(this._translate),
        })
    }
    editBoundary(context) {
        const { cp, vecf, vect, w, h, translate } = context;
        const deltaX = vect[0] - vecf[0];
        const deltaY = vect[1] - vecf[1];
       
        switch(cp) {
            case 'lt':
                this.w = Math.abs(w - deltaX);
                this.h = Math.abs(h - deltaY);
                break;
            case 'rt':
                this.w = Math.abs(w + deltaX);
                this.h = Math.abs(h - deltaY);
                
                break;
            case 'lb':
                this.w = Math.abs(w - deltaX);
                this.h = Math.abs(h + deltaY);
                break;
            case 'rb':
                this.w = Math.abs(w + deltaX);
                this.h = Math.abs(h + deltaY);
                break;
        }
        this.setTranslate(translate[0] + deltaX/2, translate[1] + deltaY/2)
        this.updateWorldMatrix(this.parent.matrix)
        this.markGeoDirty();
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
    getDashedBorderConfig() {
        const { 
            w, h,
            _strokeWidth, _zIndex, _currentMat, _colors,
            _strokeLineDash,
        } = this;
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
                painter: 'SDFPainter',
                configGetter: 'getConfig'
            }, {
                ctor: Ellipse,
                condition: (instance) => this._strokeWidth > 0 && this._strokeLineDash.length > 0,
                painter: 'PolylinePainter',
                configGetter: 'getDashedBorderConfig'
            }
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
