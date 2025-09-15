import { mat3 } from 'gl-matrix';
import BaseShape from './shape';
import { addDirtyWork } from '../dirty-work/dirty-work';

class Layer extends BaseShape {
    _stack = [];

    updateWorldMatrix(parentMat, grandParentMat) {
        super.updateWorldMatrix(parentMat, grandParentMat);
        const wmat = this._worldTransform;
        this._stack.forEach(instance => {
            instance.updateWorldMatrix(wmat, parentMat);
        });
    }

    // calculateDownBoundingbox(mtx) {
    //     const _m = mat3.create();
    //     const mat = this._transform.getMatrix();
    //     mat3.multiply(_m, mtx, mat);
    //     this.calculateBoundingBox(_m);
    //     this._stack.forEach(instance => {
    //         instance.calculateDownBoundingbox(_m)
    //     });
    // }

    addToStack(instance) {
        instance._belongs = this;
        this._stack.push(instance);
        const indexRBush = this.jcanvas.indexRBush;

        addDirtyWork(() => {
            indexRBush.add(instance);
        });
        addDirtyWork(this.jcanvas._bindMeshAndRender);
    }

    insertToStackBefore(instance, anchorNode) {
        let _isNew = true;
        if(instance._belongs) {
            instance._belongs.removeFromStack(instance);
            _isNew = false;
        }
        instance._belongs = this;
        const idx = this._stack.findIndex(s => s === anchorNode);
        if(idx !== -1) {
            this._stack.splice(idx, 0, instance)
        } else {
            this.addToStack(instance);
        }
        if(_isNew) {
            const indexRBush = this.jcanvas.indexRBush;
            addDirtyWork(() => {
                indexRBush.add(instance)
            });
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }

    removeFromStack(instance) {
        const index = this._stack.findIndex(i => i === instance);
        if(index !== -1) {
            this._stack.splice(index, 1);
        }
        instance._belongs = undefined;
        const indexRBush = this.jcanvas.indexRBush;
        addDirtyWork(() => {
            indexRBush.remove(instance)
        });
        addDirtyWork(this.jcanvas._bindMeshAndRender);
    }
}

export default Layer;

export function traverse(layer, callback) {
    callback(layer);
    if(layer._stack) {
        layer._stack.forEach(instance => {
            traverse(instance, callback)
        });
    };
}
