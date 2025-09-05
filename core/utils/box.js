import { vec2 } from 'gl-matrix';

export class Box {
    _lt = vec2.create();
    _rb = vec2.create();

    get bounding() {
        const { _lt, _rb } = this;
        return [
            Math.min(_lt[0], _rb[0]),
            Math.min(_lt[1], _rb[1]),
            Math.max(_lt[0], _rb[0]),
            Math.max(_lt[1], _rb[1]),
        ];
    }

    get LT(){
        return this._lt;
    }

    get RB(){
        return this._rb;
    }
}