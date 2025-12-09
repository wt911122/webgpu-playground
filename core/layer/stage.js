import { mat3, vec2 } from 'gl-matrix';
import { addDirtyWork } from '../dirty-work/dirty-work';
import Layer, { traverse, traverseOnlyLayer } from './layer';

class Stage extends Layer {
    _toolstack = [];

    addToToolStack(instance) {
        instance._belongs = this;
        this._toolstack.push(instance);
        const indexRBush = this.jcanvas.indexRBush;

        addDirtyWork(() => {
            indexRBush.add(instance);
        })
        this.meshAndRender();
    }

    insertToToolStackBefore(instance, anchorNode) {
        let _isNew = true;
        if(instance._belongs) {
            instance._belongs.removeFromStack(instance);
            _isNew = false;
        }
        instance._belongs = this;
        const idx = this._toolstack.findIndex(s => s === anchorNode);
        if(idx !== -1) {
            this._toolstack.splice(idx, 0, instance)
        } else {
            this._toolstack.push(instance);
        }
        if(_isNew) {
            const indexRBush = this.jcanvas.indexRBush;
            addDirtyWork(() => {
                indexRBush.add(instance)
            });
            this.meshAndRender();
        }
    }

    removeFromToolStack(instance) {
        const index = this._toolstack.findIndex(i => i === instance);
        if(index !== -1) {
            this._toolstack.splice(index, 1);
        }
        instance._belongs = undefined;
        const indexRBush = this.jcanvas.indexRBush;
        addDirtyWork(() => {
            indexRBush.remove(instance)
        });
        this.meshAndRender();
    }

    traverse(callback, callbackLeave) {
        this._stack.forEach(instance => {
            traverse(instance, callback, callbackLeave)
        });
        this._toolstack.forEach(instance => {
            traverse(instance, callback, callbackLeave)
        });
    }

    traverseOnlyLayer(callback, callbackLeave) {
        this._stack.forEach(instance => {
            if(instance._stack) {
                traverseOnlyLayer(instance, callback, callbackLeave)
            } else {
                callback(instance);
            }
        });
        this._toolstack.forEach(instance => {
            if(instance._stack) {
                traverseOnlyLayer(instance, callback, callbackLeave)
            } else {
                callback(instance);
            }
        });
    }

    clear() {
        this._stack.length = 0;
        const indexRBush = this.jcanvas.indexRBush;
        indexRBush.destroy();
        this.meshAndRender();
    }
}

export default Stage;
