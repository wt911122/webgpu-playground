class EventHandler {
    phase = JEVENT_PHASE.BUBBLE;
    callback = null;
    name = ''

    constructor(eventname, callback, capture = false) {
        Object.assign(this, {
            name: eventname,
            callback: callback,
        });
        if(capture) {
            this.phase = JEVENT_PHASE.CAPTURE;
        }
    }

    invoke(event) {
        if(this.callback) {
            this.callback(event);
        }
    }
}

function _comparePhase(event, handler) {
    const isbubble = (event.phase === JEVENT_PHASE.TARGET || event.phase === JEVENT_PHASE.BUBBLE);
    const iscapture = event.phase === JEVENT_PHASE.CAPTURE;
    const handlerisbuble = (handler.phase === JEVENT_PHASE.BUBBLE);
    const handleriscapture = (handler.phase === JEVENT_PHASE.CAPTURE);
    return (isbubble && handlerisbuble) || (iscapture && handleriscapture); 
}

class EventManager {
    _eventhandler_ = new Map();
    add(handler) {
        const q = this._eventhandler_.get(handler.name);
        if(!q) {
            const h = [];
            this._eventhandler_.set(handler.name, h);
            h.push(handler);
        } else {
            q.push(handler);
        }
    }
    remove(eventname, callback, capture = false) {
        const q = this._eventhandler_.get(eventname);
        if(q) {
            const targetPhase = capture ? JEVENT_PHASE.CAPTURE : JEVENT_PHASE.BUBBLE;
            const idx = q.findIndex(handler => {
                if(handler.callback === callback
                    && handler.phase === targetPhase) {
                        return true;
                    }
            });
            if(idx!==-1) {
                q.splice(idx, 1);
            }
        }
    }

    invoke(event){
        const { name } = event;
        const q = this._eventhandler_.get(name);
        if(q) {
            q.forEach(handler => {
                if(_comparePhase(event, handler)) {
                    handler.invoke(event);
                }
            });
        }
    }
}

export const JEVENT_PHASE = {
    CAPTURE: 'capture',
    TARGET: 'target',
    BUBBLE: 'bubble'
}
export class JEvent {
    name = '';
    detail = {};
    phase = JEVENT_PHASE.CAPTURE;
    _propagation = true;
    constructor(name = '', payload = {}) {
        Object.assign(this, {
            name,
            detail: payload,
        })
    }

    capturePhase() { 
        this.phase = JEVENT_PHASE.CAPTURE;
    }

    bubblePhase() {
        this.phase = JEVENT_PHASE.BUBBLE;
    }

    targetPhase() { 
        this.phase = JEVENT_PHASE.TARGET;
    }
    
    stopPropagation() {
        this._propagation = false;
    }
}


export class JEventTarget {
    _eventmanager_ = new EventManager();

    addEventListener(eventname, callback, capture){
        this._eventmanager_.add(new EventHandler(eventname, callback, capture))
    }
    removeEventListener(eventname, callback, capture) {
        this._eventmanager_.remove(eventname, callback, capture);
    }
    dispatchEvent(event) {
        this._eventmanager_.invoke(event);
    }
}