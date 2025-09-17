import * as d3 from 'd3-color';
import { mat3, vec2 } from 'gl-matrix';
import { TransformMatrix } from '../utils/transform';
import { Box } from '../utils/box';
import { addDirtyWork } from '../dirty-work/dirty-work';

class BaseShape extends EventTarget {
    _belongs = null;
    _localTransform = mat3.create();
    _currentMat = mat3.create();
    _zIndex = 0; 
    _strokeWidth = 0;

    renderable = true;
    visible = true;

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

    _boundingbox = new Box();

   
    _anchor = vec2.create();
    _materialdirty = true;
    _geodirty = true;
    

    constructor(configs = {}) {
        super();
        this.fill = (configs.fill || 'transparent');
        this.stroke = (configs.stroke || 'transparent');
        this._strokeWidth = configs.storkeWidth || 0;
        this._strokeLineDash = configs.strokeLineDash || [];
        this.shadowColor = (configs.shadowColor || 'transparent');
        this._shadowOffsetX = configs.shadowOffsetX || 0;
        this._shadowOffsetY = configs.shadowOffsetY || 0;
        this._shadowBlur = configs.shadowBlur || 0;
        this.flushColor();
        this._bindFlushColor = this.flushColor.bind(this);
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

    get parent() {
        return this._belongs;
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

    updateBoundingBox() { }

    getBoundingBox() {
        return this._boundingbox.bounding;
    }

    updateWorldMatrix(parentMat) {
        if(parentMat) {
            mat3.multiply(this._currentMat, this._localTransform, parentMat);
        } 
        // const mat = this._localTransform;
        this.updateBoundingBox();
    }
    checkHit() {
        return true;
    }
}

export default BaseShape;