import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { JOINT_TYPE, STRIDE_POINT } from '../shape/polyline/enums';
import { paddingMat3 } from '../utils/transform';

class PolyLine extends Shape {
    _path = [];
    _joints = [];
    _segments = 0;
    _strokeAlignment = 0;

    constructor(configs) {
        super(configs);
        // const { cx, cy, width, height, borderRadius } = configs;
        this.path = configs.path;
        this.lineCap = configs.lineCap;
        this.lineJoin = configs.lineJoin;
        this._strokeAlignment = configs.strokeAlignment ?? 0;
    }

    updateBoundingBox() {
        mat3.multiply(this._currentMat, this._worldTransform, this._localTransform)
    }

    set path(value) {
        this._path = value;
        this.markDirty();
    }

    getConfig() {
        const { 
            _strokeWidth, _zIndex, _currentMat, _colors,
            _strokeLineDash,
            _strokeAlignment,
        } = this;
        return {
            path: this._path,
            _strokeLineDash,
            _strokeWidth,
            _strokeAlignment,
            _zIndex, 
            _colors,
            mat: paddingMat3(_currentMat)
        }//preCalculatePointBuffer(this.path, this.lineCap, this.lineJoin);
    }
    static attachPainter(painter) {
        return [
            {
                ctor: PolyLine,
                painter: 'PolylinePainter',
                configGetter: 'getConfig'
            }
        ];
    }
}

export default PolyLine;
