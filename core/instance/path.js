import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { parse } from '../path-utils';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';

class Path extends Shape {
    _path = [];
    // _contentBox = [0,0,0,0]
    _position   = vec2.fromValues(0,0);
    _scale      = vec2.fromValues(1,1);
    _pivot      = vec2.fromValues(0,0);
    _origin     = vec2.fromValues(0,0);
    _skew       = vec2.fromValues(0,0);
    _rotation = 0;
    _cx = 1;
    _sx = 0;
    _cy = 0;
    _sy = 1;

    _strokeWidth = 0;

    set width(val) {}

    set height(val) {}

    get width()
    {
        const lc = this._localBoundingbox;
        return Math.abs((lc.RB[0] - lc.LT[0]));
    }

    get height()
    {
        const lc = this._localBoundingbox;
        return Math.abs((lc.RB[1] - lc.LT[1]));
    }

    constructor(configs) {
        super(configs);
        const { x, y, rotation } = configs;
        this.path = configs.path;
        this._strokeWidth = configs.strokeWidth || 0;
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.rotation = rotation ?? 0; 
        // this.flushTransform(true);
        this.updateLocalTransform()
    }


    set path(value) {
        const lc = this._localBoundingbox;
        if(value) {
            const result = parse(value);
            if(result) {
                const { path, box } =result;
                this._path = path;
                const [a, b, c, d] = box;
                vec2.set(lc.LT, Math.min(a, 0), Math.min(b, 0));
                vec2.set(lc.RB, c, d);
                vec2.set(lc.LB, Math.min(a, 0), d);
                vec2.set(lc.RT, c, Math.min(b, 0));
            } else {
                this._path = [];
                // this._contentBox = [0,0,0,0];
                vec2.set(lc.LT, 0, 0);
                vec2.set(lc.RB, 0, 0);
                vec2.set(lc.LB, 0, 0);
                vec2.set(lc.RT, 0, 0);
            }
            
            // this._contentBox = box;
        } else {
            this._path = [];
            // this._contentBox = [0,0,0,0];
            vec2.set(lc.LT, 0, 0);
            vec2.set(lc.RB, 0, 0);
            vec2.set(lc.LB, 0, 0);
            vec2.set(lc.RT, 0, 0);
        }
        vec2.set(this._pivot, this.width/2, this.height/2) 
        // this.flushTransform();
        // console.log(this._path)
        this.markGeoDirty();
    }
    get path() {
        return this._path;
    }

    updateBoundingBox() {
        const { LT, RB, LB, RT } = this._boundingbox;
        const lc = this._localBoundingbox;
        vec2.transformMat3(LT, lc.LT, this._currentMat)
        vec2.transformMat3(RB, lc.RB, this._currentMat);
        vec2.transformMat3(LB, lc.LB, this._currentMat);
        vec2.transformMat3(RT, lc.RT, this._currentMat);
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.refresh(this);
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
    editBoundaryStart(context) {
        const mat = this._localTransform;
        Object.assign(context, {
            scale: vec2.clone(this._scale),
            bounding: vec2.fromValues(this.width, this.height),
            position: vec2.clone(this._position),
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

        const sw = (bounding[0] + vecDelta[0]) / bounding[0] * scale[0];
        const sh = (bounding[1] + vecDelta[1]) / bounding[1] * scale[1];
        this.scale = [sw, sh];

        vec2.multiply(vecDelta, vecDelta, factor)
        vec2.transformMat3(this._tempVec, vecDelta, localUnitMat);
        vec2.add(this.position, position, this._tempVec);

        this.updateLocalTransform();
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
    }

    getMeshConfig() {
        const { 
            path, _zIndex, _colors, texture, _currentMat, _opacity, blurFilter
        } = this;
        return {
            path: this.path,
            texture,
            blurFilter,
            _opacity,
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
                condition: (instance) => (instance._fill.opacity !== 0 || instance.texture),
                painter: 'MeshPainter',
                configGetter: 'getMeshConfig'
            }, 
            {
                ctor: Path,
                condition: (instance) => instance._strokeWidth > 0 && instance._stroke.opacity !== 0 ,
                painter: 'SmoothPolyline',
                configGetter: 'getPolylineConfig'
            }
        ];
    }
}

export default Path;