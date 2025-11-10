import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { parse } from '../path-utils';

class MSDFText extends Shape {
    _fontFamily = undefined;
    _content = '';
    _fontSize = 1/256;
    
    w = 0;
    h = 0;


    get x() {
        return this._position[0];
    }

    set x(value){
        this._position[0] = value;
    }

    get y() {
        return this._position[1];
    }

    set y(value){
        this._position[1] = value;
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

    constructor(configs) {
        super(configs);
        const { x, y, fontFamily, content, fontSize } = configs;
        this._fontFamily = fontFamily;
        this._content = content;
        this._fontSize = fontSize || 1/256;
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.flushTransform();
        // mat3.translate(this._localTransform, this._localTransform, [x, y]);
    }

    // set font(val) {
    //     this._font = font;
    //     this.markFontDirty();
    // }
    // get font() {
    //     return this._font;
    // }
    
    set content(val) {
        this._content = val;
        this.markFontDirty();
    }
    get content() {
        return this._content;
    }

    set fontSize(val) {
        this._fontSize = val;
        this.markFontDirty();
    }
    get fontSize() {
        return this._fontSize;
    }

    updateBoundingBox() {
        const { x, y, w, h } = this;
        const lc = this._localBoundingbox;
        vec2.set(lc.LT, 0, h);
        vec2.set(lc.RB, w, 0);
        vec2.set(lc.LB, 0, 0);
        vec2.set(lc.RT, w, h);

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

    markFontDirty() {
         if(this.jcanvas) {
            this._geodirty = true;
            this.addDirtyWork(this._bindFlushFontPath)
            this.addDirtyWork(this.jcanvas._bindMeshAndRender);
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
        const position = this._position;

        // get the matrix values of the container based on its this properties..
        lt[0] = this._cx;
        lt[1] = this._sx;
        lt[3] = this._cy;
        lt[4] = this._sy;

        lt[6] = position[0];
        lt[7] = position[1];

    }

    getConfig() {
        const { 
            _zIndex, _colors, _currentMat, _content, _fontSize, _fontFamily
        } = this;
        return {
            fontFamily: _fontFamily,
            content: _content,
            fontSize: _fontSize,
            _zIndex, 
            _colors, 
            mat: paddingMat3(_currentMat)
        }
    }
    checkHit(mouseVec) {
        return true;
    }

    static attachPainter(painter) {
        return [
            {
                ctor: MSDFText,
                painter: 'MSDFTextPainter',
                configGetter: 'getConfig'
            },
        ]
    }
}

export default MSDFText;