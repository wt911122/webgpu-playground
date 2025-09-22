import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { parse } from '../path-utils';

class Path extends Shape {
    _path = [];
    _contentBox = [0,0,0,0]
    constructor(configs) {
        super(configs);
        this.path = configs.path;
    }

    set path(value) {
        if(value) {
            const { path, box } = parse(value);
            this._path = path;
            this._contentBox = box;
        } else {
            this._path = [];
            this._contentBox = [0,0,0,0];
        }

        this.markGeoDirty();
    }
    get path() {
        return this._path;
    }

    updateBoundingBox() {
        const { LT, RB } = this._boundingbox;
        const [a, b, c, d] = this._contentBox;
        vec2.transformMat3(LT, [a, b], this._currentMat)
        vec2.transformMat3(RB, [c, d], this._currentMat);
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
    }

    getMeshConfig() {
        const { 
            path, _zIndex, _colors, _currentMat
        } = this;
        return {
            path: this.path,
            _zIndex, 
            _colors, 
            mat: paddingMat3(_currentMat)
        }
    }

    getPolylineConfig() {
        const { 
            path, _strokeWidth, _zIndex, _currentMat, _colors,
            _strokeLineDash
        } = this;

        return {
            path: path,
            _strokeWidth,
            _strokeAlignment: 0,
            _strokeLineDash,
            _zIndex: _zIndex+0.1, 
            _colors,
            mat: paddingMat3(_currentMat)
        }
    }

    static attachPainter(painter) {
        return [
            {
                ctor: Path,
                condition: (instance) => instance.path.closePath && instance._fill.opacity !== 0,
                painter: 'MeshPainter',
                configGetter: 'getMeshConfig'
            }, {
                ctor: Path,
                condition: (instance) => instance._strokeWidth > 0 && instance._stroke.opacity !== 0 ,
                painter: 'PolylinePainter',
                configGetter: 'getPolylineConfig'
            }
        ];
    }
}

export default Path;