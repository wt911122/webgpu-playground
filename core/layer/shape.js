import * as d3 from 'd3-color';
import { mat3, vec2 } from 'gl-matrix';
import { TransformMatrix } from '../utils/transform';
import { Box } from '../utils/box';
import { addDirtyWork } from '../dirty-work/dirty-work';
import { JEventTarget } from '../event/event-target';

class BaseShape extends JEventTarget {
    _belongs = null;

    _translate = vec2.fromValues(0,0);
    _scale = vec2.fromValues(1,1);
    _rotation = 0;

    _localTransform = mat3.create();
    _currentMat = mat3.create();
    _zIndex = 0; 
    _strokeWidth = 0;

    renderable = true;
    _visible = true;
    _boundingbox = null;

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

    

   
    _anchor = vec2.create();
    _materialdirty = true;
    _geodirty = true;
    

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
        this.flushTransform();
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

    updateBoundingBox() { }

    getBoundingBox() {
        return this._boundingbox.bounding;
    }

    getBoundingBoxForRbush() {
        return this._boundingbox.boundingRbush;
    }

    editBoundaryStart(context) {}
    editBoundary(context) {}
    editBoundaryEnd() {}

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

    translate(vec) {
        vec2.add(this._translate, this._translate, vec);
        this.flushTransform();
    }

    setTranslate(x, y) {
        vec2.set(this._translate, x, y);
        this.flushTransform();
    }
    setScale(x, y) {
        vec2.set(this._scale, x, y);
        this.flushTransform();     
    }
    flushTransform() {
        mat3.identity(this._localTransform);
        mat3.translate(this._localTransform, this._localTransform, this._translate);
        mat3.scale(this._localTransform, this._localTransform, this._scale);
    }

    extractTransformation() {
        const matrix = this._localTransform;
        vec2.set(this._translate, matrix[6], matrix[7]);

        const scaleX = Math.sqrt(matrix[0] * matrix[0] + matrix[3] * matrix[3]);
        const scaleY = Math.sqrt(matrix[1] * matrix[1] + matrix[4] * matrix[4]);
        vec2.set(this._scale, scaleX, scaleY);

        this._rotation = Math.atan2(matrix[3] / scaleX, matrix[0] / scaleX);
    }
}

export default BaseShape;