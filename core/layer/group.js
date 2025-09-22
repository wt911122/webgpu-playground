import { mat3, vec2 } from 'gl-matrix';
import Layer from './layer';

class Group extends Layer {
    renderable = false;
    lock = false;

    constructor(configs = {}) {
        super(configs);
        const { x = 0, y = 0, lock } = configs;
        this.lock = !!lock;
        this.setTranslate(x, y);
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

    editBoundaryStart(context) {
        const { LT, RB } = this._boundingbox;
        Object.assign(context, {
            w: RB[0] - LT[0], 
            h: RB[1] - LT[1], 
            translate: vec2.clone(this._translate),
            scale: vec2.clone(this._scale),
        })
    }

    editBoundary(context) {
        const { cp, vecf, vect, w, h, translate, scale } = context;
        const deltaX = vect[0] - vecf[0];
        const deltaY = vect[1] - vecf[1];
        let nextWidth;
        let nextHeight;
        switch(cp) {
            case 'lt':
                nextWidth = Math.abs(w - deltaX);
                nextHeight = Math.abs(h - deltaY);
                this.setTranslate(translate[0] + deltaX, translate[1] + deltaY)
                break;
            case 'rt':
                nextWidth = Math.abs(w + deltaX);
                nextHeight = Math.abs(h - deltaY);
                this.setTranslate(translate[0], translate[1] + deltaY)
                break;
            case 'lb':
                nextWidth = Math.abs(w - deltaX);
                nextHeight = Math.abs(h + deltaY);
                this.setTranslate(translate[0] + deltaX, translate[1])
                break;
            case 'rb':
                nextWidth = Math.abs(w + deltaX);
                nextHeight = Math.abs(h + deltaY);
                break;
        }
        this.setScale(scale[0]*nextWidth/w, scale[1]*nextHeight/h)
        
        this.updateWorldMatrix(this.parent.matrix)
        this.markMaterialDrity();
    }
    editBoundaryEnd() {

    }

    static attachPainter() {
        return [];
    }
}

export default Group;