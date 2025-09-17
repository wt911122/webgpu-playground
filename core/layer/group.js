import { mat3, vec2 } from 'gl-matrix';
import Layer from './layer';

class Group extends Layer {
    renderable = false;
    lock = false;

    constructor(configs = {}) {
        super(configs);
        const { x = 0, y = 0, lock } = configs;
        this.lock = !!lock;
        mat3.translate(this._localTransform, this._localTransform, [x, y]);
    }

    updateBoundingBox() {
        const { LT, RB } = this._boundingbox;
        LT[0] = Infinity;
        LT[1] = Infinity;
        RB[0] = -Infinity;
        RB[1] = -Infinity;
        this._stack.forEach(instance => {
            const { _lt, _rb } = instance._boundingbox;
            LT[0] = Math.min(_lt[0], _rb[0], LT[0]);
            LT[1] = Math.min(_lt[1], _rb[1], LT[1]);
            RB[0] = Math.max(_lt[0], _rb[0], RB[0]);
            RB[1] = Math.max(_lt[1], _rb[1], RB[1]);
        });
        // const indexRBush = this.jcanvas.indexRBush;
        // indexRBush.refresh(this);
    }

    checkHit(mouseVec) {
        // const q = this._stack.find(instance => {
        //     return instance.checkHit(mouseVec);
        // });
        // return !!q;
    }

    static attachPainter() {
        return [];
    }
}

export default Group;