import { vec2 } from 'gl-matrix';

export class Box {
    _lt = vec2.create();
    _lb = vec2.create();
    _rt = vec2.create();
    _rb = vec2.create();

    _boundingboxforRBush = { 
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        shape: null,
    };

    get boundingRbush() {
        const { _lt, _rb, _lb, _rt, _boundingboxforRBush } = this;
        _boundingboxforRBush.minX = Math.min(_lt[0], _rb[0], _lb[0], _rt[0]);
        _boundingboxforRBush.minY = Math.min(_lt[1], _rb[1], _lb[1], _rt[1]);
        _boundingboxforRBush.maxX = Math.max(_lt[0], _rb[0], _lb[0], _rt[0]);
        _boundingboxforRBush.maxY = Math.max(_lt[1], _rb[1], _lb[1], _rt[1]);
        return _boundingboxforRBush;
    }

    get LT(){
        return this._lt;
    }

    get RB(){
        return this._rb;
    }

    get LB(){
        return this._lb;
    }

    get RT(){
        return this._rt;
    }
    constructor(shape) {
        this._boundingboxforRBush.shape = shape;
    }

    toString() {
        return `[${this.LT[0]}, ${this.LT[1]}, ${this.RT[0]}, ${this.RT[1]}]`
    }
}