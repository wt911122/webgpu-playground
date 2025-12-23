import Shape from '../layer/shape';
import { mat3, vec2 } from 'gl-matrix';
import { paddingMat3 } from '../utils/transform';
import { parse } from '../path-utils';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';

class MSDFText extends Shape {
    _fontFamily = undefined;
    _content = '';
    _fontSize = 12;
    _textAlignHorizontal = 'LEFT';
    _textAlignVertical = 'CENTER';
    _lineHeight = undefined;
    _autoWrap = false;
    _ellipseEnd = false;
    textWidth = 0;
    textHeight = 0;
    

    constructor(configs) {
        super(configs);
        const { x, y, width, height, textAlignHorizontal, textAlignVertical, lineHeight, fontFamily, content, fontSize, autoWrap, ellipseEnd } = configs;
        this._fontFamily = fontFamily;
        this._content = content;
        this._fontSize = fontSize || 1/256;
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.definedWidth = width;
        this.definedHeight = height;
        this._textAlignHorizontal = textAlignHorizontal ?? 'LEFT';
        this._textAlignVertical = textAlignVertical ?? 'CENTER';
        this._lineHeight = lineHeight;
        this._autoWrap = autoWrap ?? false;
        this._ellipseEnd = ellipseEnd ?? false;
        this.updateLocalTransform();
        // this.flushTransform();
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
        this.markGeoDirty();
    }
    get content() {
        return this._content;
    }

    set fontSize(val) {
        this._fontSize = val;
    }
    get fontSize() {
        return this._fontSize;
    }

    measureWidth() {
        if(this._stopPivotResponse) {
            this.w = Math.max(this.definedWidth || 0, this.textWidth);
            this.h = Math.max(0, this.definedHeight ?? this.textHeight);
        } else {
            this.width = Math.max(this.definedWidth || 0, this.textWidth);
            this.height = Math.max(0, this.definedHeight ?? this.textHeight);
        }
       
    }

    updateBoundingBox() {
        const { x, y, w, h } = this;
        const lc = this._localBoundingbox;
        vec2.set(lc.LT, 0, 0);
        vec2.set(lc.RB, w, h);
        vec2.set(lc.LB, 0, h);
        vec2.set(lc.RT, w, 0);
        // vec2.set(this._origin, w/2, h/2);

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
            position: vec2.clone(this.position),
            localMat: mat3.clone(mat),
            localUnitMat: mat3.fromValues(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5], 0,0,1)
        });
        this._stopPivotResponse = true;
    }

    editBoundary(context) {
        const { cp, vecDelta, vecDeltaP, bounding, scale, position, localMat, localUnitMat } = context;
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

        const width = bounding[0] + vecDelta[0];
        const height = bounding[1] + vecDelta[1];
        // console.log(width, height)
        this.definedWidth = width;
        this.definedHeight = height;
        // console.log(vecDelta)
        vec2.multiply(vecDelta, vecDelta, factor)
        vec2.transformMat3(this._tempVec, vecDelta, localUnitMat);
        vec2.add(this.position, position, this._tempVec);

        this.updateLocalTransform();
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
        this.markGeoDirty()
    }

    editBoundaryEnd(context) {
        // 平移 pivot
        this._stopPivotResponse = false;
        const newPivot = vec2.fromValues(this.w/2, this.h/2);
        const _localTransform = this._localTransform;
        const a = _localTransform[0];
        const b = _localTransform[1];
        const c = _localTransform[3];
        const d = _localTransform[4];
        const tx = _localTransform[6];
        const ty = _localTransform[7];
        const currentPivot = this._pivot;
        const origin = this._origin;
        const position = this._position;
        const cx = a * currentPivot[0] + c * currentPivot[1] - currentPivot[0];
        const cy = b * currentPivot[0] + d * currentPivot[1] - currentPivot[1];
        const ncx = a * newPivot[0] + c * newPivot[1] - newPivot[0];
        const ncy = b * newPivot[0] + d * newPivot[1] - newPivot[1];
        this._position[0] = position[0] - cx + ncx;
        this._position[1] = position[1] - cy + ncy;
        this.pivot = newPivot;
        this.updateLocalTransform();
        this.updateWorldMatrix(this.parent.matrix);
        this.markMaterialDrity();
    }


    getConfig() {
        const { 
            _zIndex, _colors, 
            _currentMat, 
            _content, 
            _fontSize, 
            _fontFamily,
            _textAlignVertical,
            _textAlignHorizontal,
            _lineHeight,
            _autoWrap,
            _ellipseEnd,
            definedWidth, 
            definedHeight,
        } = this;
        return {
            definedWidth, 
            definedHeight,
            fontFamily: _fontFamily,
            content: _content,
            fontSize: _fontSize,
            textAlignVertical: _textAlignVertical,
            textAlignHorizontal: _textAlignHorizontal,
            lineHeight: _lineHeight,
            autoWrap: _autoWrap,
            ellipseEnd: _ellipseEnd,
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