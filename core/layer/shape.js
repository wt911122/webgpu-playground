import * as d3 from 'd3-color';
import { mat3, vec2 } from 'gl-matrix';
import { TransformMatrix } from '../utils/transform';
import { Box } from '../utils/box';
import { calculateAngle, PI_2, RAD_TO_DEG, DEG_TO_RAD } from '../utils/geometric';
import { addDirtyWork } from '../dirty-work/dirty-work';
import { JEventTarget } from '../event/event-target';

class BaseShape extends JEventTarget {
    _belongs = null;

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
    _tempVec = vec2.create();

    _localTransform = mat3.create();
    _currentMat = mat3.create();
    _currentMatInv = mat3.create();
    _zIndex = 0; 
    _strokeWidth = 0;

    renderable = true;
    _visible = true;
    _boundingbox = null;
    _localBoundingbox = null;

    _fill = undefined;
    _stroke = undefined;
    _shadowColor = undefined;
    _strokeLineDash = [];


    _colors = new Float32Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
    ])

    _shadowOffsetX = 0;
    _shadowOffsetY = 0;
    _shadowBlur = 0;

    _materialdirty = true;
    _geodirty = true;
    
    _tempP = vec2.create();


    constructor(configs = {}) {
        super();
        this.visible = configs.visible ?? true;
        this.fill = (configs.fill || 'transparent');
        this.stroke = (configs.stroke || 'transparent');
        this._strokeWidth = configs.strokeWidth || 0;
        this._strokeLineDash = configs.strokeLineDash || [];
        this.shadowColor = (configs.shadowColor || 'transparent');
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
        // this.flushTransform();
    }

    set fill(value) {
        const c = d3.color(value || 'transparent');
        this._fill = c;
        if(this.jcanvas) {
            this._materialdirty = true;
            addDirtyWork(this._bindFlushColor)
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }
    set stroke(value) {
        const c = d3.color(value || 'transparent');
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
        const c = d3.color(value || 'transparent');
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

    flushColor() {
        const fill = this._fill.rgb();
        const stroke = this._stroke.rgb();
        const shadowColor = this._shadowColor.rgb();
        const colors = this._colors;
        colors[0] = fill.r;
        colors[1] = fill.g;
        colors[2] = fill.b;
        colors[3] = fill.opacity;
        colors[4] = stroke.r;
        colors[5] = stroke.g;
        colors[6] = stroke.b;
        colors[7] = stroke.opacity;
        colors[8] = shadowColor.r;
        colors[9] = shadowColor.g;
        colors[10] = shadowColor.b;
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
}

export default BaseShape;