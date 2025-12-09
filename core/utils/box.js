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

export function doOverlapBoxBounding(box1, box2) {
    const br1 = box1._boundingboxforRBush;
    const br2 = box2._boundingboxforRBush;
    if (br1.minX == br1.maxX || br1.minY == br1.maxY  ||
        br2.minX == br2.maxX || br2.minY == br2.maxY ) {
        return false;
    }

    return !(br1.maxX <= br2.minX ||
        br1.maxY <= br2.minY ||
        br1.minX >= br2.maxX || 
        br1.minY >= br2.maxY);
}

export function doOverlapBox(box1, box2) {
    const LTBox1 = box1.LT;
    const RBBox1 = box1.RB;
    const LTBox2 = box2.LT;
    const RBBox2 = box2.RB;
    
    if (LTBox1[0] == RBBox1[0] || LTBox1[1] == RBBox1[1] ||
        LTBox2[0] == RBBox2[0] || LTBox2[1] == RBBox2[1]) {
        return false;
    }

    return !(RBBox1[0] <= LTBox2[0] ||   // left
                RBBox1[1] <= LTBox2[1] ||   // bottom
                LTBox1[0] >= RBBox2[0] ||   // right
                LTBox1[1] >= RBBox2[1]);    // top
}