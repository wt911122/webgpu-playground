import { vec2 } from 'gl-matrix';

export class Box {
    _lt = vec2.create();
    _rb = vec2.create();

    _boundingboxforRBush = { 
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        shape: null,
    };
    get bounding() {
        const { _lt, _rb } = this;
        return [
            Math.min(_lt[0], _rb[0]),
            Math.min(_lt[1], _rb[1]),
            Math.max(_lt[0], _rb[0]),
            Math.max(_lt[1], _rb[1]),
        ];
    }

    get boundingRbush() {
        const { _lt, _rb, _boundingboxforRBush } = this;
        _boundingboxforRBush.minX = Math.min(_lt[0], _rb[0]);
        _boundingboxforRBush.minY = Math.min(_lt[1], _rb[1]);
        _boundingboxforRBush.maxX = Math.max(_lt[0], _rb[0]);
        _boundingboxforRBush.maxY = Math.max(_lt[1], _rb[1]);
        return _boundingboxforRBush;
    }

    get LT(){
        return this._lt;
    }

    get RB(){
        return this._rb;
    }
    constructor(shape) {
        this._boundingboxforRBush.shape = shape;
    }
}