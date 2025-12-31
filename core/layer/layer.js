import { mat3 } from 'gl-matrix';
import BaseShape from './shape';
import { addDirtyWork } from '../dirty-work/dirty-work';

class Layer extends BaseShape {
    _stack = [];

    updateWorldMatrix(parentMat) {
        if(parentMat) {
            mat3.multiply(this._currentMat, parentMat, this._localTransform);
            mat3.invert(this._currentMatInv, this._currentMat);
        } 
        const wmat = this._currentMat;
        this._stack.forEach(instance => {
            instance.updateWorldMatrix(wmat);
        });
        this.updateBoundingBox();
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
        })
        this.meshAndRender();
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
            this._stack.push(instance);
        }
        if(_isNew) {
            const indexRBush = this.jcanvas.indexRBush;
            addDirtyWork(() => {
                indexRBush.add(instance)
            });
            this.meshAndRender();
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
        this.meshAndRender();
    }

    meshAndRender() {
        if(this.jcanvas._bindMeshAndRender) {
            addDirtyWork(this.jcanvas._bindMeshAndRender);
        }
    }

    markMaterialDrity() {
        if(this.jcanvas) {
            this._stack.forEach(instance => {
                instance.markMaterialDrity();
            });
        }
    }

    clear() {
        this._stack.length = 0;
    }
}

export default Layer;

export function traverse(layer, callback, callbackLeave) {
    callback(layer);
    if(layer._stack) {
        layer._stack.forEach(instance => {
            traverse(instance, callback, callbackLeave)
        });
    };
    callbackLeave(layer);
}

export function traverseOnlyLayer(layer, callback, callbackLeave) {
    if(layer._stack) {
        // callback(layer);
        // layer._stack.forEach(instance => {
        //     traverseOnlyLayer(instance, callback, callbackLeave)
        // });
        // callbackLeave(layer);

        callback(layer);
        let i = layer._stack.length-1;
        while(i >= 0) {
            const instance = layer._stack[i];
            traverseOnlyLayer(instance, callback, callbackLeave)
            i--;
        }
        callbackLeave(layer);
    };
}

