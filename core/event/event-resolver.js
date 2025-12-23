import { JEvent, JEVENT_PHASE } from './event-target';
import { vec2, mat3 } from 'gl-matrix';

const DRAG_DROP_PHASE = {
    DRAGSTART: 'DRAGSTART',
    DRAGGING: 'DRAGGING',
    DRAGEND: 'DRAGEND',
}
class JDragDropEvent extends JEvent {
    phase = JEVENT_PHASE.TARGET;
    _useDefaultAction = true;
    doDragstart(payload) {
        this.name = 'dragstart';
        Object.assign(this.detail, payload)
    }

    doDragging(payload) {
        this.name = 'dragging';
        Object.assign(this.detail, payload)
    }
    doDragend(payload) {
        this.name = 'dragend';
        Object.assign(this.detail, payload)
    }

    preventDefault() {
        this._useDefaultAction = false;
    }

    get useDefault(){
        return this._useDefaultAction;
    }

}
function EventResolver() {

    function checkTarget(target) {
        if(target.represent) {
            return target.represent;
        }
        let t = target;

        while(t.parent) {
            if(t.parent.lock) {
                return t.parent;
            }
            t = t.parent;
        }
        return target;
    }
    function _lockTarget(x, y) {
        const lockedTarget = jc.lockTarget(x, y);
        if(lockTarget) {
            return checkTarget(lockedTarget);
        }
        return null;
    }

    function _propagation(eventname, target, rawEvent, location) {
        const event = new JEvent(eventname, {
            target,
            relativeTarget: null,
            offsetX: rawEvent.offsetX,
            offsetY: rawEvent.offsetY,
            canvasX: location[0],
            canvasY: location[1],
        })
        let q = [];
        let t = target.parent;
        while(t){
            q.push(t);
            t = t.parent;
        }

        const l = q.length;
        for(let i=l-1;i>=0;i--) {
            if(event._propagation) {
                event.relativeTarget = q[i];
                q[i].dispatchEvent(event);
            } else {
                return;
            }
        }
        event.targetPhase();
        target.dispatchEvent(event);
        
        if(!event._propagation) {
            return;
        }
        event.bubblePhase();
        for(let i=0;i<l;i++) {
            if(event._propagation) {
                event.relativeTarget = q[i];
                q[i].dispatchEvent(event);
            } else {
                return;
            }
        }
    }

    function _trigger(eventname, target, rawEvent, location) {
        const event = new JEvent(eventname, {
            target,
            relativeTarget: target,
            offsetX: rawEvent.offsetX,
            offsetY: rawEvent.offsetY,
            canvasX: location[0],
            canvasY: location[1],
        });
        event.targetPhase();
        target.dispatchEvent(event);
    }


    function _dragdropBehavior(canvas, {
        dragStart,
        dragMove,
        dragEnd
    }) {
        canvas.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const { offsetX, offsetY } = event;
            let processing = false;
            let dragging = false;
            const f = (e) => {
                if(processing) {
                    return;
                }
                processing = true;
                if(dragging) {
                    // console.log('dragmove!')
                    dragMove(e.offsetX, e.offsetY);
                    processing = false;
                    return;
                }

                const { offsetX: currX, offsetY: currY } = e;
                if(Math.hypot(currX - offsetX, currY - offsetY) > 2) {
                    
                    dragging = dragStart(offsetX, offsetY);
                    // console.log('dragstart!', dragging)
                }
                processing = false;
            }

            const u = (event) => {
                document.removeEventListener('pointermove', f);
                if(dragging) {
                    dragEnd(event.offsetX, event.offsetY);
                }
                processing = false;
                dragging = false;
            }
            document.addEventListener('pointermove', f)  
            document.addEventListener('pointerup', u, {
                once: true,
                capture: true,
            });
        
        })
    }

    function _triggerDragEvent(eventname, target, rawEvent, location) {
        const event = new JDragDropEvent(eventname, {
            target,
            relativeTarget: target,
            offsetX: rawEvent.offsetX,
            offsetY: rawEvent.offsetY,
            canvasX: location[0],
            canvasY: location[1],
        });
        target.dispatchEvent(event);
    }

    const EVENT_STATUS = {
        dragging: false,
    }

    /* function initDragDrop(canvas, jc) {
        const context = {
            target: null,
            targetLocalMtx: null,
            targetWorldMtxInv: mat3.create(),
            pos: null,
            vec: vec2.create(),
            event: null
        };
        _dragdropBehavior(canvas, {
            dragStart(x, y) {
                const lockedTarget = jc.lockTarget(x, y);
                if(lockedTarget) {
                    const target = checkTarget(lockedTarget);
                    
                    context.target = target;
                    context.targetLocalMtx = mat3.clone(target._localTransform)
                    mat3.invert(context.targetWorldMtxInv, target.parent.matrix)
                    context.pos = vec2.clone(jc._mousevec)
                    const event = new JDragDropEvent();
                    event.doDragstart({
                        target,
                        relativeTarget: target,
                        offsetX: x,
                        offsetY: y,
                        canvasX: context.pos[0],
                        canvasY: context.pos[1],
                    });
                    target.dispatchEvent(event);
                    _trigger('dragstartonstage', jc.stage, event.detail, jc._mousevec);
                    context.event = event;
                    EVENT_STATUS.dragging = true;
                    return true;
                }
            },
            dragMove(x, y) {
                const { target, vec, pos, targetLocalMtx, targetWorldMtxInv, event } = context;
                jc.viewport2Canvas(x, y, vec);
                if(event._propagation) {
                    event.doDragging({
                        offsetX: x,
                        offsetY: y,
                        canvasX: vec[0],
                        canvasY: vec[1],
                    })
                    target.dispatchEvent(event);
                }
                if(event.useDefault) {
                    const locationMtx = target._localTransform;
                    vec2.subtract(vec, vec, pos);
                    vec2.transformMat3(vec, vec, targetWorldMtxInv);
                    mat3.translate(locationMtx, targetLocalMtx, vec);
                    target.updateWorldMatrix(target.parent.matrix);
                    target.markMaterialDrity();
                }
            },
            dragEnd(x, y) {
                const { target, vec, pos, targetLocalMtx, targetWorldMtxInv, event } = context;
                if(event._propagation) {
                    jc.viewport2Canvas(x, y, vec);
                    event.doDragend({
                        offsetX: x,
                        offsetY: y,
                        canvasX: vec[0],
                        canvasY: vec[1],
                    })
                    target.dispatchEvent(event);
                    _trigger('dragendonstage', jc.stage, event.detail, vec);
                }
                Object.assign(context, {
                    target: null,
                    targetLocalMtx: null,
                    targetWorldMtxInv: mat3.create(),
                    pos: null,
                    vec: vec2.create(),
                })
                EVENT_STATUS.dragging = false;
            }
        })
    }*/

    function initDragDrop(canvas, jc) {
        const context = {
            target: null,
            targetPosition: null,
            targetWorldMtx: null,
            canvasPos: null,
            targetPos: vec2.create(),
            vec: vec2.create(),
            event: null
        };
        _dragdropBehavior(canvas, {
            dragStart(x, y) {
                const lockedTarget = jc.lockTarget(x, y);
                if(lockedTarget) {
                    const target = checkTarget(lockedTarget);
                    
                    context.target = target;
                    context.targetPosition = vec2.clone(target.position)
                    context.targetWorldMtx = mat3.clone(target.parent.matrixInv)
                    // mat3.invert(context.targetWorldMtxInv, target.parent.matrix)
                    context.canvasPos = vec2.clone(jc._mousevec);
                    vec2.transformMat3(context.targetPos, context.canvasPos, context.targetWorldMtx);
                    const event = new JDragDropEvent();
                    event.doDragstart({
                        target,
                        relativeTarget: target,
                        offsetX: x,
                        offsetY: y,
                        canvasX: context.canvasPos[0],
                        canvasY: context.canvasPos[1],
                    });
                    target.dispatchEvent(event);
                    _trigger('dragstartonstage', jc.stage, event.detail, jc._mousevec);
                    context.event = event;
                    EVENT_STATUS.dragging = true;
                    return true;
                }
            },
            dragMove(x, y) {
                const { target, targetPosition, targetWorldMtx, canvasPos, targetPos, vec, event } = context;
                jc.viewport2Canvas(x, y, vec);
                if(event._propagation) {
                    event.doDragging({
                        offsetX: x,
                        offsetY: y,
                        canvasX: vec[0],
                        canvasY: vec[1],
                    })
                    target.dispatchEvent(event);
                }
                if(event.useDefault) {

                    vec2.transformMat3(vec, vec, targetWorldMtx);
                    vec2.subtract(vec, vec, targetPos);
                    vec2.add(vec, targetPosition, vec)
                    target.position = vec;
                    target.updateLocalTransform();

                    target.updateWorldMatrix(target.parent.matrix);
                    target.markMaterialDrity();
                }
            },
            dragEnd(x, y) {
                const { target, vec, pos, targetLocalMtx, targetWorldMtxInv, event } = context;
                if(event._propagation) {
                    jc.viewport2Canvas(x, y, vec);
                    event.doDragend({
                        offsetX: x,
                        offsetY: y,
                        canvasX: vec[0],
                        canvasY: vec[1],
                    })
                    target.dispatchEvent(event);
                    _trigger('dragendonstage', jc.stage, event.detail, vec);
                }
                Object.assign(context, {
                    target: null,
                    targetLocalMtx: null,
                    targetWorldMtxInv: mat3.create(),
                    pos: null,
                    vec: vec2.create(),
                })
                EVENT_STATUS.dragging = false;
            }
        })
    }

    function initMouseEnterLeave(canvas, jc) {
        let currentTarget = null;
        canvas.addEventListener('pointermove', (event) => {
            event.preventDefault();
            if(EVENT_STATUS.dragging) {
                return;
            }
            const { offsetX, offsetY } = event;
            const lockedTarget = jc.lockTarget(offsetX, offsetY);
            const target = lockedTarget && checkTarget(lockedTarget);
            if(currentTarget !== target) {
                if(currentTarget) {
                    _trigger('mouseleave', currentTarget, event, jc._mousevec);
                }
                currentTarget = target;
                if(target) {
                    _trigger('mouseenter', target, event, jc._mousevec);
                }
            } 
        })
    }

    function initMouseClick(canvas, jc) {
        canvas.addEventListener('pointerdown', event => {
            event.preventDefault();
            const { offsetX, offsetY } = event;
            let dirty = false;
            const f = (e) => {
                if(e.offsetX !== offsetX || e.offsetY !== offsetY) {
                    dirty = true;
                }
            }
            const u = (event) => {
                document.removeEventListener('pointermove', f);
                if(!dirty) {
                    const { offsetX, offsetY } = event;
                    const lockedTarget = jc.lockTarget(offsetX, offsetY);
                    if(lockedTarget) {
                        const target = checkTarget(lockedTarget);
                        _propagation('click', 
                            target, 
                            event,
                            jc._mousevec);
                    } else {
                        _trigger('click', 
                            jc.stage, 
                            event,
                            jc._mousevec)
                    }
                }
            }
            document.addEventListener('pointermove', f)  
            document.addEventListener('pointerup', u, {
                once: true,
                capture: true,
            });
        })
    }

    function setup(context) {
        const canvas = context.canvas;
        const jc = context.jcanvas;
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            let { offsetX, offsetY, deltaX, deltaY } = event
            if(event.ctrlKey) { 
                jc.zoom(offsetX, offsetY, deltaX, deltaY);
            } else {
                jc.pan(deltaX, deltaY);
            }
        });

        // canvas.addEventListener('click', (event) => {
        //     event.preventDefault();
        //     const { offsetX, offsetY } = event;
        //     const lockedTarget = jc.lockTarget(x, y);
        //     if(lockedTarget) {
        //         const target = checkTarget(lockedTarget);
        //         _propagation('click', 
        //             target, 
        //             event,
        //             jc.currentMouseLocation);
        //     }
        // })
        
        initMouseEnterLeave(canvas, jc);
        initDragDrop(canvas, jc);
        initMouseClick(canvas, jc);
    }

    return {
        name: 'EventResolver',
        setup,
    }
}

export default EventResolver;