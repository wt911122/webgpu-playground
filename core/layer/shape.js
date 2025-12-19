import * as d3 from 'd3-color';
import { mat3, vec2 } from 'gl-matrix';
import { updateLocalTransform, decomposeLocalTransform } from '../utils/transform';
import { Box } from '../utils/box';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';
import { addDirtyWork } from '../dirty-work/dirty-work';
import { JEventTarget } from '../event/event-target';

const TRANSPARENT = 'rgba(0,0,0,0)';
class BaseShape extends JEventTarget {
    _belongs = null;

    _position   = vec2.fromValues(0,0);
    _scale      = vec2.fromValues(1,1);
    _pivot      = vec2.fromValues(0,0);
    _origin     = vec2.fromValues(0,0);
    _skew       = vec2.fromValues(0,0); //暂时不要了
    _rotation = 0;
    _cx = 1;
    _sx = 0;
    _cy = 0;
    _sy = 1;
    _tempVec = vec2.create();

    _localTransform = mat3.create();
    _currentMat = mat3.create();
    _currentMatInv = mat3.create();
    _zIndex = 0; 
    
    _maskIndex = 0;
    _maskLayer = 0;
    _workAsMask = false;


    _strokeWidth = 0;

    renderable = true;
    _visible = true;
    _boundingbox = null;
    _localBoundingbox = null;

    _fill = undefined;
    _texture = undefined;
    _stroke = undefined;
    _shadowColor = undefined;
    _strokeLineDash = [];
    
    _filters = [];

    _colors = new Float32Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
    ])
    _opacity = 1;

    _shadowOffsetX = 0;
    _shadowOffsetY = 0;
    _shadowBlur = 0;

    _materialdirty = true;
    _geodirty = true;
    
    _tempP = vec2.create();


    constructor(configs = {}) {
        super();
        this.visible = configs.visible ?? true;
        this.fill = (configs.fill || TRANSPARENT);
        this.texture = configs.texture || undefined;
        this.blurFilter = configs.blurFilter || undefined;
        this.stroke = (configs.stroke || TRANSPARENT);
        this._opacity = configs.opacity ?? 1;
        // this._strokeWidth = configs.strokeWidth || 0;
        // this._strokeLineDash = configs.strokeLineDash || [];
        this.shadowColor = (configs.shadowColor || TRANSPARENT);
        this._shadowOffsetX = configs.shadowOffsetX || 0;
        this._shadowOffsetY = configs.shadowOffsetY || 0;
        this._shadowBlur = configs.shadowBlur || 0;
        this.flushColor();
        this._bindFlushColor = this.flushColor.bind(this);
        this._boundingbox = new Box(this);
        this._localBoundingbox = new Box(this);
        // if(configs.rotation) {
        //     this.setRotation(configs.rotation)
        // }
        // if(configs.scale) {
        //     this._scale = configs.scale;
        // }
    }

    set fill(value) {
        const c = d3.color(value || TRANSPARENT);
        this._fill = c;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this._bindFlushColor)
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set texture(value) {
        if(value) {
            this._textureInstance = value;
        } else {
            this._textureInstance = undefined;
        }
        if(this.jcanvas) {
            this._materialdirty = true;
            this._texturedirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set stroke(value) {
        const c = d3.color(value || TRANSPARENT);
        this._stroke = c;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this._bindFlushColor)
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set strokeLineDash(value) {
        this._strokeLineDash = value || [];
        this.markDirty();
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }

    set shadowColor(value) {
        const c = d3.color(value || TRANSPARENT);
        this._shadowColor = c;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this._bindFlushColor)
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set shadowOffsetX(value) {
        this._shadowOffsetX = value || 0;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set shadowOffsetY(value) {
        this._shadowOffsetY = value || 0;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set shadowBlur(value) {
        this._shadowBlur = value || 0;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }

    get fill() {
        return this._fill.toString();
    }

    get texture() {
        return this._textureInstance;
    }
    
    get stroke() {
        return this._stroke.toString();
    }

    get shadowColor() {
        return this._shadowColor.toString();
    }

    get matrix() {
        return this._currentMat;
    }
    get matrixInv() {
        return this._currentMatInv;
    }

    get parent() {
        return this._belongs;
    }

    set visible(val) {
        this._visible = val;
        this.markMaterialDrity();
    }
    get visible() {
        return this._visible;
    }

    get useTexture() {
        return false;
    }

    flushColor() {
        const fill = this._fill.rgb();
        const stroke = this._stroke.rgb();
        const shadowColor = this._shadowColor.rgb();
        const colors = this._colors;
        colors[0] = getColorChannel(fill.r);
        colors[1] = getColorChannel(fill.g);
        colors[2] = getColorChannel(fill.b);
        colors[3] = fill.opacity;
        colors[4] = getColorChannel(stroke.r);
        colors[5] = getColorChannel(stroke.g);
        colors[6] = getColorChannel(stroke.b);
        colors[7] = stroke.opacity;
        colors[8] =     getColorChannel(shadowColor.r);
        colors[9] =     getColorChannel(shadowColor.g);
        colors[10] =    getColorChannel(shadowColor.b);
        colors[11] = shadowColor.opacity;
    }

    markGeoDirty() {
        if(this.jcanvas) {
            this._geodirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    markMaterialDrity() {
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }

    addDirtyWork(callback) {
        addDirtyWork(callback)
    }

    getBoundingBox() {
        return this._boundingbox;
    }

    getBoundingBoxForRbush() {
        return this._boundingbox.boundingRbush;
    }
    
    updateBoundingBox() {

    }

    setLocalTransform(m11,m12,m13, m21,m22,m23) {
        mat3.set(this._localTransform,
            m11, m21, 0,
            m12, m22, 0,
            m13, m23, 1
        );
    }

    updateWorldMatrix(parentMat) {
        if(parentMat) {
            mat3.multiply(this._currentMat, parentMat, this._localTransform);
            mat3.invert(this._currentMatInv, this._currentMat);
        } 
        this.updateBoundingBox();
    }
    checkHit() {
        return true;
    }

    rotateStart(context) {
        Object.assign(context, {
            rotation: this._rotation,
        });
    }

    rotate(context) {

    }

    rotateEnd(context) {

    }


    editBoundaryStart(context) {

    }

    editBoundary(context) {}

    editBoundaryEnd(context) {}


    updateLocalTransform() {
        updateLocalTransform(this);
    }
    decomposeLocalTransform() {
        decomposeLocalTransform(this);
    }
    applyLocalTransform(
        m00, m01,
        m10, m11,
        m20, m21, 
    ) {
        mat3.set(this._localTransform, m00, m01, 0, m10, m11, 0, m20, m21, 1)
    }


    applyFilter(filter, options) {
        this.filters.push(filter);
    }
}

export default BaseShape;

function getColorChannel(c) {
    return isNaN(c) ? 0 : c;
}