import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { parse } from '../path-utils';

class Path extends Shape {
    _path = [];

    constructor(configs) {
        super(configs);
        this.path = configs.path;
    }

    set path(value) {
        this._path = parse(value);
        this.markDirty();
    }
    get path() {
        return this._path;
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
                condition: (instance) => instance.path.closePath && instance.fill.opacity !== 0,
                painter: 'MeshPainter',
                configGetter: 'getMeshConfig'
            }, {
                ctor: Path,
                condition: (instance) => instance._strokeWidth > 0 && instance.stroke.opacity !== 0 ,
                painter: 'PolylinePainter',
                configGetter: 'getPolylineConfig'
            }
        ];
    }
}

export default Path;